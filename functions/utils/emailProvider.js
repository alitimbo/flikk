const net = require("net");
const os = require("os");
const tls = require("tls");
const { logger } = require("firebase-functions");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EMAIL_HOST = "mail.belemdev.tech";
const DEFAULT_EMAIL_FALLBACK_HOST = "mail30.lwspanel.com";
const DEFAULT_EMAIL_USER = "contact@belemdev.tech";

const OTP_EMAIL_PROVIDER_MODE = (
  process.env.OTP_EMAIL_PROVIDER_MODE || "smtp"
).toLowerCase();
const OTP_EMAIL_FROM = process.env.OTP_EMAIL_FROM || DEFAULT_EMAIL_USER;
const OTP_EMAIL_SUBJECT_TEMPLATE =
  process.env.OTP_EMAIL_SUBJECT_TEMPLATE || "Votre code Flikk";
const OTP_EMAIL_MESSAGE_TEMPLATE =
  process.env.OTP_EMAIL_MESSAGE_TEMPLATE ||
  "<p>Votre code Flikk est <strong>{{code}}</strong>.</p><p>Ce code expire dans {{minutes}} minute(s).</p>";
const OTP_EMAIL_TEXT_TEMPLATE =
  process.env.OTP_EMAIL_TEXT_TEMPLATE ||
  "Votre code Flikk est {{code}}. Ce code expire dans {{minutes}} minute(s).";

// SMTP mode (default)
const OTP_EMAIL_SMTP_HOST = process.env.OTP_EMAIL_SMTP_HOST || DEFAULT_EMAIL_HOST;
const OTP_EMAIL_SMTP_FALLBACK_HOST =
  process.env.OTP_EMAIL_SMTP_FALLBACK_HOST || DEFAULT_EMAIL_FALLBACK_HOST;
const OTP_EMAIL_SMTP_PORT = Number(process.env.OTP_EMAIL_SMTP_PORT || 465);
const OTP_EMAIL_SMTP_SECURE = String(
  process.env.OTP_EMAIL_SMTP_SECURE || "true",
).toLowerCase() !== "false";
const OTP_EMAIL_SMTP_USER = process.env.OTP_EMAIL_SMTP_USER || DEFAULT_EMAIL_USER;
const OTP_EMAIL_SMTP_PASSWORD = process.env.OTP_EMAIL_SMTP_PASSWORD || "";
const OTP_EMAIL_SMTP_TIMEOUT_MS = Number(
  process.env.OTP_EMAIL_SMTP_TIMEOUT_MS || 20000,
);
const OTP_EMAIL_SMTP_REQUIRE_AUTH = String(
  process.env.OTP_EMAIL_SMTP_REQUIRE_AUTH || "true",
).toLowerCase() !== "false";
const OTP_EMAIL_SMTP_REJECT_UNAUTHORIZED = String(
  process.env.OTP_EMAIL_SMTP_REJECT_UNAUTHORIZED || "true",
).toLowerCase() !== "false";

// Legacy API mode (optional)
const OTP_EMAIL_API_URL = process.env.OTP_EMAIL_API_URL || "";
const OTP_EMAIL_API_TOKEN = process.env.OTP_EMAIL_API_TOKEN || "";
const OTP_EMAIL_HTTP_METHOD = (
  process.env.OTP_EMAIL_HTTP_METHOD || "POST"
).toUpperCase();
const OTP_EMAIL_TOKEN_HEADER =
  process.env.OTP_EMAIL_TOKEN_HEADER || "Authorization";
const OTP_EMAIL_TOKEN_PREFIX = process.env.OTP_EMAIL_TOKEN_PREFIX || "Bearer";
const OTP_EMAIL_TO_FIELD = process.env.OTP_EMAIL_TO_FIELD || "to";
const OTP_EMAIL_SUBJECT_FIELD =
  process.env.OTP_EMAIL_SUBJECT_FIELD || "subject";
const OTP_EMAIL_MESSAGE_FIELD = process.env.OTP_EMAIL_MESSAGE_FIELD || "html";
const OTP_EMAIL_FROM_FIELD = process.env.OTP_EMAIL_FROM_FIELD || "from";
const OTP_EMAIL_TIMEOUT_MS = Number(process.env.OTP_EMAIL_TIMEOUT_MS || 15000);
const OTP_EMAIL_EXTRA_PAYLOAD_JSON =
  process.env.OTP_EMAIL_EXTRA_PAYLOAD_JSON || "";

function assertValidEmailAddress(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return normalized;
}

function buildSubject() {
  return OTP_EMAIL_SUBJECT_TEMPLATE;
}

function buildHtmlMessage(code, expiresInSec) {
  const minutes = Math.max(1, Math.ceil(expiresInSec / 60));
  return OTP_EMAIL_MESSAGE_TEMPLATE.replace("{{code}}", code).replace(
    "{{minutes}}",
    String(minutes),
  );
}

function buildTextMessage(code, expiresInSec) {
  const minutes = Math.max(1, Math.ceil(expiresInSec / 60));
  return OTP_EMAIL_TEXT_TEMPLATE.replace("{{code}}", code).replace(
    "{{minutes}}",
    String(minutes),
  );
}

function parseExtraPayload() {
  if (!OTP_EMAIL_EXTRA_PAYLOAD_JSON) {
    return {};
  }
  try {
    const parsed = JSON.parse(OTP_EMAIL_EXTRA_PAYLOAD_JSON);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    logger.warn("Invalid OTP_EMAIL_EXTRA_PAYLOAD_JSON. Ignoring.");
    return {};
  }
}

function buildApiHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };

  if (OTP_EMAIL_API_TOKEN) {
    headers[OTP_EMAIL_TOKEN_HEADER] = OTP_EMAIL_TOKEN_PREFIX
      ? `${OTP_EMAIL_TOKEN_PREFIX} ${OTP_EMAIL_API_TOKEN}`
      : OTP_EMAIL_API_TOKEN;
  }

  return headers;
}

function maskEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.indexOf("@");
  if (atIndex <= 1) {
    return "***";
  }
  return `${normalized.slice(0, 2)}***${normalized.slice(atIndex)}`;
}

function createResponseCollector(socket) {
  let buffer = "";
  let current = null;
  const pendingResponses = [];
  const waiters = [];

  function pushResponse(response) {
    if (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter.resolve(response);
      return;
    }
    pendingResponses.push(response);
  }

  function parseLine(line) {
    const match = /^(\d{3})([ -])(.*)$/.exec(line);
    if (!match) {
      return;
    }

    const code = Number(match[1]);
    const separator = match[2];
    const text = match[3] || "";

    if (!current || current.code !== code) {
      current = { code, lines: [] };
    }
    current.lines.push(text);

    if (separator === " ") {
      pushResponse({
        code,
        text: current.lines.join("\n").trim(),
      });
      current = null;
    }
  }

  function parseBuffer() {
    while (true) {
      const lineBreak = buffer.indexOf("\r\n");
      if (lineBreak === -1) {
        return;
      }
      const line = buffer.slice(0, lineBreak);
      buffer = buffer.slice(lineBreak + 2);
      parseLine(line);
    }
  }

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    parseBuffer();
  });

  socket.on("error", (error) => {
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      waiter.reject(error);
    }
  });

  function nextResponse(timeoutMs) {
    if (pendingResponses.length > 0) {
      return Promise.resolve(pendingResponses.shift());
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = waiters.findIndex((item) => item.resolve === resolve);
        if (index >= 0) {
          waiters.splice(index, 1);
        }
        reject(new Error("SMTP_TIMEOUT"));
      }, timeoutMs);

      waiters.push({
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  return {
    nextResponse,
  };
}

function ensureExpectedCode(response, expectedCodes, context) {
  if (expectedCodes.includes(response.code)) {
    return;
  }
  throw new Error(
    `${context}: SMTP response ${response.code} (${response.text || "no message"})`,
  );
}

async function sendSmtpCommand(socket, collector, command, expectedCodes) {
  if (command) {
    socket.write(`${command}\r\n`);
  }
  const response = await collector.nextResponse(OTP_EMAIL_SMTP_TIMEOUT_MS);
  ensureExpectedCode(response, expectedCodes, command || "SMTP greeting");
  return response;
}

function dotStuff(content) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function buildMimeMessage({ from, to, subject, textBody, htmlBody }) {
  const boundary = `flikk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const headers = [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Message-ID: <${Date.now()}@${os.hostname()}>`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    textBody,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function openSmtpSocket(host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      reject(error);
    };

    if (OTP_EMAIL_SMTP_SECURE) {
      const socket = tls.connect(
        {
          host,
          port: OTP_EMAIL_SMTP_PORT,
          servername: host,
          rejectUnauthorized: OTP_EMAIL_SMTP_REJECT_UNAUTHORIZED,
        },
        () => {
          socket.removeListener("error", onError);
          resolve(socket);
        },
      );
      socket.once("error", onError);
      socket.setTimeout(OTP_EMAIL_SMTP_TIMEOUT_MS, () => {
        socket.destroy(new Error("SMTP_SOCKET_TIMEOUT"));
      });
      return;
    }

    const socket = net.connect(
      {
        host,
        port: OTP_EMAIL_SMTP_PORT,
      },
      () => {
        socket.removeListener("error", onError);
        resolve(socket);
      },
    );
    socket.once("error", onError);
    socket.setTimeout(OTP_EMAIL_SMTP_TIMEOUT_MS, () => {
      socket.destroy(new Error("SMTP_SOCKET_TIMEOUT"));
    });
  });
}

function assertSmtpConfig() {
  assertValidEmailAddress(OTP_EMAIL_FROM, "OTP_EMAIL_FROM");
  assertValidEmailAddress(OTP_EMAIL_SMTP_USER, "OTP_EMAIL_SMTP_USER");

  if (!OTP_EMAIL_SMTP_PASSWORD) {
    throw new Error("Missing OTP_EMAIL_SMTP_PASSWORD");
  }
}

async function sendViaSmtpHost({
  host,
  to,
  subject,
  textBody,
  htmlBody,
}) {
  const socket = await openSmtpSocket(host);
  const collector = createResponseCollector(socket);

  try {
    await sendSmtpCommand(socket, collector, null, [220]);
    await sendSmtpCommand(socket, collector, `EHLO ${host}`, [250]);

    if (OTP_EMAIL_SMTP_REQUIRE_AUTH) {
      await sendSmtpCommand(socket, collector, "AUTH LOGIN", [334]);
      await sendSmtpCommand(
        socket,
        collector,
        Buffer.from(OTP_EMAIL_SMTP_USER, "utf8").toString("base64"),
        [334],
      );
      await sendSmtpCommand(
        socket,
        collector,
        Buffer.from(OTP_EMAIL_SMTP_PASSWORD, "utf8").toString("base64"),
        [235],
      );
    }

    await sendSmtpCommand(
      socket,
      collector,
      `MAIL FROM:<${OTP_EMAIL_FROM}>`,
      [250],
    );
    await sendSmtpCommand(socket, collector, `RCPT TO:<${to}>`, [250, 251]);
    await sendSmtpCommand(socket, collector, "DATA", [354]);

    const mime = buildMimeMessage({
      from: OTP_EMAIL_FROM,
      to,
      subject,
      textBody,
      htmlBody,
    });
    socket.write(`${dotStuff(mime)}\r\n.\r\n`);
    await sendSmtpCommand(socket, collector, null, [250]);
    await sendSmtpCommand(socket, collector, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

async function sendOtpEmailWithSmtp({ to, code, expiresInSec }) {
  assertSmtpConfig();
  const normalizedTo = assertValidEmailAddress(to, "to");
  const subject = buildSubject();
  const htmlBody = buildHtmlMessage(code, expiresInSec);
  const textBody = buildTextMessage(code, expiresInSec);

  const hosts = [OTP_EMAIL_SMTP_HOST, OTP_EMAIL_SMTP_FALLBACK_HOST].filter(
    (value, index, array) => value && array.indexOf(value) === index,
  );

  let lastError = null;
  for (const host of hosts) {
    try {
      await sendViaSmtpHost({
        host,
        to: normalizedTo,
        subject,
        textBody,
        htmlBody,
      });
      return;
    } catch (error) {
      lastError = error;
      logger.warn("OTP SMTP send failed on host", {
        host,
        to: maskEmail(normalizedTo),
        error: error?.message || String(error),
      });
    }
  }

  throw lastError || new Error("OTP_SMTP_SEND_FAILED");
}

function assertApiConfig() {
  if (!OTP_EMAIL_API_URL) {
    throw new Error("Missing OTP_EMAIL_API_URL");
  }
  assertValidEmailAddress(OTP_EMAIL_FROM, "OTP_EMAIL_FROM");
}

async function sendOtpEmailWithApi({ to, code, expiresInSec }) {
  assertApiConfig();
  const normalizedTo = assertValidEmailAddress(to, "to");

  const payload = {
    ...parseExtraPayload(),
    [OTP_EMAIL_TO_FIELD]: normalizedTo,
    [OTP_EMAIL_FROM_FIELD]: OTP_EMAIL_FROM,
    [OTP_EMAIL_SUBJECT_FIELD]: buildSubject(),
    [OTP_EMAIL_MESSAGE_FIELD]: buildHtmlMessage(code, expiresInSec),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OTP_EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch(OTP_EMAIL_API_URL, {
      method: OTP_EMAIL_HTTP_METHOD,
      headers: buildApiHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error("OTP email API send failed", {
        status: response.status,
        body,
      });
      throw new Error("OTP_EMAIL_API_PROVIDER_FAILED");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendOtpEmail({ to, code, expiresInSec }) {
  if (OTP_EMAIL_PROVIDER_MODE === "api") {
    await sendOtpEmailWithApi({ to, code, expiresInSec });
    return;
  }
  await sendOtpEmailWithSmtp({ to, code, expiresInSec });
}

module.exports = {
  sendOtpEmail,
};
