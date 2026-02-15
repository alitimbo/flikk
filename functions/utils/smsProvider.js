const { logger } = require("firebase-functions");

const OTP_SMS_API_URL = process.env.OTP_SMS_API_URL || "";
const OTP_SMS_API_TOKEN = process.env.OTP_SMS_API_TOKEN || "";
const OTP_SMS_HTTP_METHOD = (process.env.OTP_SMS_HTTP_METHOD || "POST").toUpperCase();
const OTP_SMS_TOKEN_HEADER = process.env.OTP_SMS_TOKEN_HEADER || "Authorization";
const OTP_SMS_TOKEN_PREFIX = process.env.OTP_SMS_TOKEN_PREFIX || "Bearer";
const OTP_SMS_TO_FIELD = process.env.OTP_SMS_TO_FIELD || "to";
const OTP_SMS_MESSAGE_FIELD = process.env.OTP_SMS_MESSAGE_FIELD || "message";
const OTP_SMS_SENDER_FIELD = process.env.OTP_SMS_SENDER_FIELD || "sender";
const OTP_SMS_SENDER = process.env.OTP_SMS_SENDER || "";
const OTP_SMS_TIMEOUT_MS = Number(process.env.OTP_SMS_TIMEOUT_MS || 15000);
const OTP_SMS_EXTRA_PAYLOAD_JSON = process.env.OTP_SMS_EXTRA_PAYLOAD_JSON || "";
const OTP_MESSAGE_TEMPLATE =
  process.env.OTP_SMS_MESSAGE_TEMPLATE ||
  "Votre code Flikk est {{code}}. Ce code expire dans {{minutes}} min.";

function assertSmsConfig() {
  if (!OTP_SMS_API_URL) {
    throw new Error("Missing OTP_SMS_API_URL");
  }
  if (!OTP_SMS_API_TOKEN) {
    throw new Error("Missing OTP_SMS_API_TOKEN");
  }
}

function buildMessage(code, expiresInSec) {
  const minutes = Math.max(1, Math.ceil(expiresInSec / 60));
  return OTP_MESSAGE_TEMPLATE.replace("{{code}}", code).replace(
    "{{minutes}}",
    String(minutes),
  );
}

function parseExtraPayload() {
  if (!OTP_SMS_EXTRA_PAYLOAD_JSON) return {};
  try {
    const parsed = JSON.parse(OTP_SMS_EXTRA_PAYLOAD_JSON);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    logger.warn("Invalid OTP_SMS_EXTRA_PAYLOAD_JSON. Ignoring.");
    return {};
  }
}

async function sendOtpSms({ to, code, expiresInSec }) {
  assertSmsConfig();

  const payload = {
    ...parseExtraPayload(),
    [OTP_SMS_TO_FIELD]: to,
    [OTP_SMS_MESSAGE_FIELD]: buildMessage(code, expiresInSec),
  };
  if (OTP_SMS_SENDER) {
    payload[OTP_SMS_SENDER_FIELD] = OTP_SMS_SENDER;
  }

  const headers = {
    "Content-Type": "application/json",
    [OTP_SMS_TOKEN_HEADER]: OTP_SMS_TOKEN_PREFIX
      ? `${OTP_SMS_TOKEN_PREFIX} ${OTP_SMS_API_TOKEN}`
      : OTP_SMS_API_TOKEN,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OTP_SMS_TIMEOUT_MS);

  try {
    const response = await fetch(OTP_SMS_API_URL, {
      method: OTP_SMS_HTTP_METHOD,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error("OTP SMS send failed", {
        status: response.status,
        body,
      });
      throw new Error("OTP_SMS_PROVIDER_FAILED");
    }
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  sendOtpSms,
};
