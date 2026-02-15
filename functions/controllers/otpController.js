const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { sendOtpSms } = require("../utils/smsProvider");
const {
  normalizePhoneNumber,
  generateOtpCode,
  createOtpHash,
  verifyOtpCode,
  challengeDocId,
  rateLimitDocId,
} = require("../utils/otpUtils");

const OTP_EXPIRES_IN_SEC = Number(process.env.OTP_EXPIRES_IN_SEC || 300);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 30);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RATE_WINDOW_SECONDS = Number(process.env.OTP_RATE_WINDOW_SECONDS || 600);
const OTP_MAX_PER_WINDOW = Number(process.env.OTP_MAX_PER_WINDOW || 5);
const OTP_LOCK_MINUTES = Number(process.env.OTP_LOCK_MINUTES || 30);

function nowMillis() {
  return Date.now();
}

function toTimestamp(ms) {
  return admin.firestore.Timestamp.fromMillis(ms);
}

function buildAuthDefaults(uid, phoneNumber) {
  return {
    uid,
    phoneNumber,
    role: "customer",
    status: "active",
    isMerchant: false,
    freeUsageCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function ensureUserProfile(uid, phoneNumber) {
  const userRef = admin.firestore().collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    await userRef.set(buildAuthDefaults(uid, phoneNumber));
    return;
  }
  const currentPhone = snap.data()?.phoneNumber;
  if (!currentPhone) {
    await userRef.set(
      {
        phoneNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function getOrCreateAuthUser(phoneNumber) {
  try {
    const existing = await admin.auth().getUserByPhoneNumber(phoneNumber);
    return { uid: existing.uid, isNewUser: false };
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await admin.auth().createUser({ phoneNumber });
  return { uid: created.uid, isNewUser: true };
}

exports.requestOtpCode = onCall({ invoker: "public" }, async (request) => {
  const phoneE164 = normalizePhoneNumber(request.data?.phoneNumber);
  if (!phoneE164) {
    throw new HttpsError("invalid-argument", "Invalid phoneNumber format.");
  }

  const now = nowMillis();
  const rateDocId = rateLimitDocId(phoneE164);
  const rateRef = admin.firestore().collection("otpRateLimits").doc(rateDocId);

  const rateCheck = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const data = snap.data() || {};

    const blockedUntilMs = data.blockedUntil?.toMillis?.() || 0;
    if (blockedUntilMs > now) {
      return { blocked: true, retryAfterSec: Math.ceil((blockedUntilMs - now) / 1000) };
    }

    const windowStartMs = data.windowStartedAt?.toMillis?.() || 0;
    const windowExpired = !windowStartMs || now - windowStartMs > OTP_RATE_WINDOW_SECONDS * 1000;
    const sentInWindow = windowExpired ? 0 : Number(data.sentInWindow || 0);
    const nextCount = sentInWindow + 1;

    if (nextCount > OTP_MAX_PER_WINDOW) {
      const blockedUntil = now + OTP_LOCK_MINUTES * 60 * 1000;
      tx.set(
        rateRef,
        {
          phoneE164,
          blockedUntil: toTimestamp(blockedUntil),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { blocked: true, retryAfterSec: OTP_LOCK_MINUTES * 60 };
    }

    tx.set(
      rateRef,
      {
        phoneE164,
        windowStartedAt: toTimestamp(windowExpired ? now : windowStartMs),
        sentInWindow: nextCount,
        lastSentAt: toTimestamp(now),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { blocked: false, retryAfterSec: OTP_RESEND_SECONDS };
  });

  if (rateCheck.blocked) {
    throw new HttpsError(
      "resource-exhausted",
      `Too many OTP requests. Retry in ${rateCheck.retryAfterSec}s.`,
    );
  }

  const challengeId = challengeDocId();
  const otpCode = generateOtpCode();
  const { codeHash, salt } = createOtpHash(challengeId, otpCode);
  const expiresAtMs = now + OTP_EXPIRES_IN_SEC * 1000;

  const challengeRef = admin.firestore().collection("otpChallenges").doc(challengeId);
  await challengeRef.set({
    challengeId,
    phoneE164,
    codeHash,
    salt,
    status: "pending",
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt: toTimestamp(expiresAtMs),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await sendOtpSms({
      to: phoneE164,
      code: otpCode,
      expiresInSec: OTP_EXPIRES_IN_SEC,
    });
  } catch (error) {
    logger.error("requestOtpCode sms send error", {
      phoneE164,
      error: error?.message || String(error),
    });
    await challengeRef.set(
      {
        status: "send_failed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw new HttpsError("internal", "Failed to send OTP code.");
  }

  return {
    challengeId,
    expiresInSec: OTP_EXPIRES_IN_SEC,
    resendAfterSec: OTP_RESEND_SECONDS,
  };
});

exports.verifyOtpCode = onCall({ invoker: "public" }, async (request) => {
  const challengeId = String(request.data?.challengeId || "").trim();
  const otpCode = String(request.data?.code || "").replace(/\s/g, "");

  if (!challengeId || !otpCode) {
    throw new HttpsError("invalid-argument", "challengeId and code are required.");
  }

  const challengeRef = admin.firestore().collection("otpChallenges").doc(challengeId);
  const now = nowMillis();

  const check = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists) {
      return { ok: false, code: "NOT_FOUND" };
    }

    const challenge = snap.data() || {};
    const status = challenge.status || "pending";
    if (status !== "pending") {
      return { ok: false, code: "NOT_PENDING" };
    }

    const expiresAtMs = challenge.expiresAt?.toMillis?.() || 0;
    if (!expiresAtMs || expiresAtMs <= now) {
      tx.set(
        challengeRef,
        {
          status: "expired",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: false, code: "EXPIRED" };
    }

    const attempts = Number(challenge.attempts || 0);
    const maxAttempts = Number(challenge.maxAttempts || OTP_MAX_ATTEMPTS);
    if (attempts >= maxAttempts) {
      tx.set(
        challengeRef,
        {
          status: "locked",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: false, code: "LOCKED" };
    }

    const valid = verifyOtpCode(challengeId, otpCode, challenge.salt, challenge.codeHash);
    if (!valid) {
      const nextAttempts = attempts + 1;
      tx.set(
        challengeRef,
        {
          attempts: nextAttempts,
          status: nextAttempts >= maxAttempts ? "locked" : "pending",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: false, code: nextAttempts >= maxAttempts ? "LOCKED" : "INVALID_CODE" };
    }

    tx.set(
      challengeRef,
      {
        status: "verified",
        attempts: attempts + 1,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true, phoneE164: challenge.phoneE164 };
  });

  if (!check.ok) {
    switch (check.code) {
      case "NOT_FOUND":
        throw new HttpsError("not-found", "OTP challenge not found.");
      case "NOT_PENDING":
        throw new HttpsError("failed-precondition", "OTP challenge is no longer pending.");
      case "EXPIRED":
        throw new HttpsError("deadline-exceeded", "OTP code expired.");
      case "LOCKED":
        throw new HttpsError("resource-exhausted", "Too many attempts.");
      default:
        throw new HttpsError("invalid-argument", "Invalid OTP code.");
    }
  }

  const { uid, isNewUser } = await getOrCreateAuthUser(check.phoneE164);
  await ensureUserProfile(uid, check.phoneE164);

  const customToken = await admin.auth().createCustomToken(uid, {
    authMethod: "otp_sms",
  });

  return {
    customToken,
    uid,
    isNewUser,
  };
});
