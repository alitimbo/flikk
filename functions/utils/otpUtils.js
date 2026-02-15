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

function rateLimitDocId(phoneE164) {
  return `p_${phoneE164.replace(/\D/g, "")}`;
}

module.exports = {
  OTP_CODE_LENGTH,
  normalizePhoneNumber,
  generateOtpCode,
  createOtpHash,
  verifyOtpCode,
  challengeDocId,
  rateLimitDocId,
};
