# Custom OTP Auth Architecture

## Goal
- Support custom OTP generation for both SMS and Email channels.
- Keep Firebase as identity provider through `customToken`.
- Make provider integrations channel-agnostic via environment variables only.

## Cloud Functions
- `requestOtpCode` (callable, public)
  - Input: `{ channel?: "sms" | "email", phoneNumber?: string, email?: string }`
  - Steps:
    - Resolve target channel (`sms` by default, `email` when requested).
    - Normalize target (`phoneNumber` to E.164 or lowercase email).
    - Enforce rate-limit (`otpRateLimits/{channel_target}`).
    - Generate OTP + hash, store challenge in `otpChallenges/{challengeId}`.
    - Send OTP through provider API (`utils/smsProvider.js` or `utils/emailProvider.js`).
  - Output: `{ challengeId, channel, maskedTarget, expiresInSec, resendAfterSec }`
- `verifyOtpCode` (callable, public)
  - Input: `{ challengeId, code }`
  - Steps:
    - Validate challenge state, TTL, attempts.
    - Verify hashed code.
    - Create/find Firebase Auth user by phone or email based on challenge channel.
    - Create Firebase custom token.
    - Ensure Firestore profile exists (`users/{uid}`) with safe defaults.
  - Output: `{ customToken, uid, isNewUser, channel }`

## Collections
- `otpChallenges/{challengeId}`
  - `channel`, `target`, `phoneE164 | emailNormalized`, `codeHash`, `salt`, `status`, `attempts`, `maxAttempts`, `expiresAt`, timestamps.
- `otpRateLimits/{rateDocId}`
  - `windowStartedAt`, `sentInWindow`, `lastSentAt`, optional `blockedUntil`.
- `users/{uid}`
  - created if missing: `role=customer`, `status=active`, `isMerchant=false`, `freeUsageCount=0`, plus email/phone when available.

## Frontend Flow
- Request SMS code: `CustomOtpAuthService.requestOtpCode(fullPhone)`
- Request email code: `CustomOtpAuthService.requestOtpCodeByEmail(email)`
- Verify code + sign in: `CustomOtpAuthService.signInWithOtp(challengeId, code)`
  - Internally calls `signInWithCustomToken()`.

## SMS Provider Env Contract
- `OTP_SMS_API_URL`
- `OTP_SMS_API_TOKEN`
- `OTP_SMS_HTTP_METHOD` (default `POST`)
- `OTP_SMS_TOKEN_HEADER` (default `Authorization`)
- `OTP_SMS_TOKEN_PREFIX` (default `Bearer`)
- `OTP_SMS_TO_FIELD` (default `to`)
- `OTP_SMS_MESSAGE_FIELD` (default `message`)
- `OTP_SMS_SENDER_FIELD` (default `sender`)
- `OTP_SMS_SENDER`
- `OTP_SMS_EXTRA_PAYLOAD_JSON` (optional JSON)
- `OTP_SMS_TIMEOUT_MS`
- `OTP_SMS_MESSAGE_TEMPLATE` (`{{code}}`, `{{minutes}}`)

## Email Provider Env Contract (SMTP by default)
- `OTP_EMAIL_PROVIDER_MODE` (`smtp` by default, `api` optional)
- `OTP_EMAIL_FROM` (default `contact@belemdev.tech`)
- `OTP_EMAIL_SUBJECT_TEMPLATE`
- `OTP_EMAIL_MESSAGE_TEMPLATE` (`{{code}}`, `{{minutes}}`)
- `OTP_EMAIL_TEXT_TEMPLATE` (`{{code}}`, `{{minutes}}`)

### SMTP mode (`OTP_EMAIL_PROVIDER_MODE=smtp`)
- `OTP_EMAIL_SMTP_HOST` (default `mail.belemdev.tech`)
- `OTP_EMAIL_SMTP_FALLBACK_HOST` (default `mail30.lwspanel.com`)
- `OTP_EMAIL_SMTP_PORT` (default `465`)
- `OTP_EMAIL_SMTP_SECURE` (default `true`)
- `OTP_EMAIL_SMTP_USER` (default `contact@belemdev.tech`)
- `OTP_EMAIL_SMTP_PASSWORD` (**required**)
- `OTP_EMAIL_SMTP_REQUIRE_AUTH` (default `true`)
- `OTP_EMAIL_SMTP_REJECT_UNAUTHORIZED` (default `true`)
- `OTP_EMAIL_SMTP_TIMEOUT_MS`

### Optional API mode (`OTP_EMAIL_PROVIDER_MODE=api`)
- `OTP_EMAIL_API_URL`
- `OTP_EMAIL_API_TOKEN`
- `OTP_EMAIL_HTTP_METHOD` (default `POST`)
- `OTP_EMAIL_TOKEN_HEADER` (default `Authorization`)
- `OTP_EMAIL_TOKEN_PREFIX` (default `Bearer`)
- `OTP_EMAIL_TO_FIELD` (default `to`)
- `OTP_EMAIL_FROM_FIELD` (default `from`)
- `OTP_EMAIL_SUBJECT_FIELD` (default `subject`)
- `OTP_EMAIL_MESSAGE_FIELD` (default `html`)
- `OTP_EMAIL_EXTRA_PAYLOAD_JSON` (optional JSON)
- `OTP_EMAIL_TIMEOUT_MS`

All keys are documented in `functions/.env.otp.example`.

## Security Notes
- OTP codes are never stored in plaintext.
- Code verification uses timing-safe compare.
- Rate-limit and lockout are enforced server-side.
- Challenge is one-time (`status=verified` once consumed).
- Keep callable endpoints behind App Check in production if possible.
