const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { sendOtpSms } = require("../utils/smsProvider");
const { sendOtpEmail } = require("../utils/emailProvider");
const {
  normalizePhoneNumber,
  normalizeEmail,
  generateOtpCode,
  createOtpHash,
  verifyOtpCode,
  challengeDocId,
  rateLimitDocId,
} = require("../utils/otpUtils");

const OTP_EXPIRES_IN_SEC = Number(process.env.OTP_EXPIRES_IN_SEC || 300);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 30);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const OTP_RATE_WINDOW_SECONDS = Number(
  process.env.OTP_RATE_WINDOW_SECONDS || 600,
);
const OTP_MAX_PER_WINDOW = Number(process.env.OTP_MAX_PER_WINDOW || 5);
const OTP_LOCK_MINUTES = Number(process.env.OTP_LOCK_MINUTES || 30);

function nowMillis() {
  return Date.now();
}

function toTimestamp(ms) {
  return admin.firestore.Timestamp.fromMillis(ms);
}

function maskPhone(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (digits.length <= 4) {
    return `+***${digits}`;
  }
  return `+***${digits.slice(-4)}`;
}

function maskEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return "***";
  }
  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visibleLocal = localPart.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}

function resolveChannelAndTarget(input) {
  const requestedChannel = String(input?.channel || "")
    .trim()
    .toLowerCase();
  const email = normalizeEmail(input?.email);
  const phoneE164 = normalizePhoneNumber(input?.phoneNumber);

  if (requestedChannel === "email" || (!requestedChannel && email)) {
    if (!email) {
      throw new HttpsError("invalid-argument", "Invalid email format.");
    }
    return {
      channel: "email",
      targetValue: email,
      maskedTarget: maskEmail(email),
    };
  }

  if (!phoneE164) {
    throw new HttpsError("invalid-argument", "Invalid phoneNumber format.");
  }

  return {
    channel: "sms",
    targetValue: phoneE164,
    maskedTarget: maskPhone(phoneE164),
  };
}

function buildAuthDefaults(uid, identity) {
  return {
    uid,
    phoneNumber: identity.phoneNumber || "",
    email: identity.email || "",
    role: "customer",
    status: "active",
    isMerchant: false,
    freeUsageCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function ensureUserProfile(uid, identity) {
  const userRef = admin.firestore().collection("users").doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    await userRef.set(buildAuthDefaults(uid, identity));
    return;
  }

  const current = snap.data() || {};
  const updates = {};
  if (identity.phoneNumber && !current.phoneNumber) {
    updates.phoneNumber = identity.phoneNumber;
  }
  if (identity.email && !current.email) {
    updates.email = identity.email;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(updates, { merge: true });
  }
}

async function getOrCreateAuthUserByPhone(phoneNumber) {
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

async function getOrCreateAuthUserByEmail(email) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    if (!existing.emailVerified) {
      await admin.auth().updateUser(existing.uid, { emailVerified: true });
    }
    return { uid: existing.uid, isNewUser: false };
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const created = await admin.auth().createUser({
    email,
    emailVerified: true,
  });
  return { uid: created.uid, isNewUser: true };
}

exports.requestOtpCode = onCall({ invoker: "public" }, async (request) => {
  const { channel, targetValue, maskedTarget } = resolveChannelAndTarget(
    request.data,
  );

  const now = nowMillis();
  const rateDocId = rateLimitDocId(channel, targetValue);
  const rateRef = admin.firestore().collection("otpRateLimits").doc(rateDocId);

  const rateCheck = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const data = snap.data() || {};

    const blockedUntilMs = data.blockedUntil?.toMillis?.() || 0;
    if (blockedUntilMs > now) {
      return {
        blocked: true,
        retryAfterSec: Math.ceil((blockedUntilMs - now) / 1000),
      };
    }

    const windowStartMs = data.windowStartedAt?.toMillis?.() || 0;
    const windowExpired =
      !windowStartMs || now - windowStartMs > OTP_RATE_WINDOW_SECONDS * 1000;
    const sentInWindow = windowExpired ? 0 : Number(data.sentInWindow || 0);
    const nextCount = sentInWindow + 1;

    if (nextCount > OTP_MAX_PER_WINDOW) {
      const blockedUntil = now + OTP_LOCK_MINUTES * 60 * 1000;
      tx.set(
        rateRef,
        {
          channel,
          target: targetValue,
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
        channel,
        target: targetValue,
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

  const challengeRef = admin
    .firestore()
    .collection("otpChallenges")
    .doc(challengeId);
  await challengeRef.set({
    challengeId,
    channel,
    target: targetValue,
    phoneE164: channel === "sms" ? targetValue : null,
    emailNormalized: channel === "email" ? targetValue : null,
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
    if (channel === "email") {
      await sendOtpEmail({
        to: targetValue,
        code: otpCode,
        expiresInSec: OTP_EXPIRES_IN_SEC,
      });
    } else {
      await sendOtpSms({
        to: targetValue,
        code: otpCode,
        expiresInSec: OTP_EXPIRES_IN_SEC,
      });
    }
  } catch (error) {
    logger.error("requestOtpCode send error", {
      channel,
      target: maskedTarget,
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
    channel,
    maskedTarget,
    expiresInSec: OTP_EXPIRES_IN_SEC,
    resendAfterSec: OTP_RESEND_SECONDS,
  };
});

exports.verifyOtpCode = onCall({ invoker: "public" }, async (request) => {
  const challengeId = String(request.data?.challengeId || "").trim();
  const otpCode = String(request.data?.code || "").replace(/\s/g, "");

  if (!challengeId || !otpCode) {
    throw new HttpsError(
      "invalid-argument",
      "challengeId and code are required.",
    );
  }

  const challengeRef = admin
    .firestore()
    .collection("otpChallenges")
    .doc(challengeId);
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

    const valid = verifyOtpCode(
      challengeId,
      otpCode,
      challenge.salt,
      challenge.codeHash,
    );
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
      return {
        ok: false,
        code: nextAttempts >= maxAttempts ? "LOCKED" : "INVALID_CODE",
      };
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

    const channel = challenge.channel === "email" ? "email" : "sms";
    return {
      ok: true,
      channel,
      phoneE164: challenge.phoneE164 || null,
      emailNormalized: challenge.emailNormalized || null,
    };
  });

  if (!check.ok) {
    switch (check.code) {
      case "NOT_FOUND":
        throw new HttpsError("not-found", "OTP challenge not found.");
      case "NOT_PENDING":
        throw new HttpsError(
          "failed-precondition",
          "OTP challenge is no longer pending.",
        );
      case "EXPIRED":
        throw new HttpsError("deadline-exceeded", "OTP code expired.");
      case "LOCKED":
        throw new HttpsError("resource-exhausted", "Too many attempts.");
      default:
        throw new HttpsError("invalid-argument", "Invalid OTP code.");
    }
  }

  let authResult;
  let profileIdentity;
  let authMethod;

  if (check.channel === "email") {
    if (!check.emailNormalized) {
      throw new HttpsError("failed-precondition", "Missing email challenge.");
    }
    authResult = await getOrCreateAuthUserByEmail(check.emailNormalized);
    profileIdentity = { email: check.emailNormalized };
    authMethod = "otp_email";
  } else {
    if (!check.phoneE164) {
      throw new HttpsError(
        "failed-precondition",
        "Missing phone challenge.",
      );
    }
    authResult = await getOrCreateAuthUserByPhone(check.phoneE164);
    profileIdentity = { phoneNumber: check.phoneE164 };
    authMethod = "otp_sms";
  }

  await ensureUserProfile(authResult.uid, profileIdentity);

  const customToken = await admin.auth().createCustomToken(authResult.uid, {
    authMethod,
  });

  return {
    customToken,
    uid: authResult.uid,
    isNewUser: authResult.isNewUser,
    channel: check.channel,
  };
});
