const crypto = require("crypto");

const OTP_CODE_LENGTH = Number(process.env.OTP_CODE_LENGTH || 6);

function normalizePhoneNumber(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }

  const compact = raw.replace(/[\s().-]/g, "");
  let candidate = compact;

  if (candidate.startsWith("00")) {
    candidate = `+${candidate.slice(2)}`;
  }

  if (!candidate.startsWith("+")) {
    const defaultCountryCode = String(
      process.env.OTP_DEFAULT_COUNTRY_CODE || "",
    ).replace(/\D/g, "");
    const digits = candidate.replace(/\D/g, "");
    if (!defaultCountryCode || !digits) {
      return null;
    }
    candidate = `+${defaultCountryCode}${digits}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeEmail(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return null;
  }

  return raw;
}

function generateOtpCode() {
  const max = 10 ** OTP_CODE_LENGTH;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(OTP_CODE_LENGTH, "0");
}

function hashOtpCode(challengeId, code, salt) {
  const payload = `${challengeId}:${code}:${salt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function createOtpHash(challengeId, code) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    salt,
    codeHash: hashOtpCode(challengeId, code, salt),
  };
}

function verifyOtpCode(challengeId, code, salt, codeHash) {
  const hashedInput = hashOtpCode(challengeId, code, salt);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hashedInput, "hex"),
      Buffer.from(String(codeHash || ""), "hex"),
    );
  } catch {
    return false;
  }
}

function challengeDocId() {
  return `otp_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

function sanitizeRateIdentifier(identifier) {
  return String(identifier || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function rateLimitDocId(channelOrIdentifier, maybeIdentifier) {
  const channel = maybeIdentifier ? channelOrIdentifier : "sms";
  const identifier = maybeIdentifier || channelOrIdentifier;
  const safeChannel = channel === "email" ? "email" : "sms";
  const safeIdentifier = sanitizeRateIdentifier(identifier);

  if (!safeIdentifier) {
    throw new Error("INVALID_RATE_IDENTIFIER");
  }

  return `${safeChannel}_${safeIdentifier}`;
}

module.exports = {
  OTP_CODE_LENGTH,
  normalizePhoneNumber,
  normalizeEmail,
  generateOtpCode,
  createOtpHash,
  verifyOtpCode,
  challengeDocId,
  rateLimitDocId,
};
