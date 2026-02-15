# Custom OTP Auth Architecture

## Goal
- Replace Firebase Phone OTP with custom OTP generation + SMS provider API.
- Keep Firebase as identity provider through `customToken`.
- Make SMS integration provider-agnostic via environment variables only.

## Cloud Functions
- `requestOtpCode` (callable, public)
  - Input: `{ phoneNumber }`
  - Steps:
    - Normalize number to E.164.
    - Enforce rate-limit (`otpRateLimits/{phone}`).
    - Generate OTP + hash, store challenge in `otpChallenges/{challengeId}`.
    - Send OTP through provider API (`utils/smsProvider.js`).
  - Output: `{ challengeId, expiresInSec, resendAfterSec }`
- `verifyOtpCode` (callable, public)
  - Input: `{ challengeId, code }`
  - Steps:
    - Validate challenge state, TTL, attempts.
    - Verify hashed code.
    - Create/find Firebase Auth user by phone.
    - Create Firebase custom token.
    - Ensure Firestore profile exists (`users/{uid}`) with safe defaults.
  - Output: `{ customToken, uid, isNewUser }`

## Collections
- `otpChallenges/{challengeId}`
  - `phoneE164`, `codeHash`, `salt`, `status`, `attempts`, `maxAttempts`, `expiresAt`, timestamps.
- `otpRateLimits/{phoneDocId}`
  - `windowStartedAt`, `sentInWindow`, `lastSentAt`, optional `blockedUntil`.
- `users/{uid}`
  - created if missing: `role=customer`, `status=active`, `isMerchant=false`, `freeUsageCount=0`.

## Frontend Flow
- Request code: `CustomOtpAuthService.requestOtpCode(fullPhone)`
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

All keys are documented in `functions/.env.otp.example`.

## Security Notes
- OTP codes are never stored in plaintext.
- Code verification uses timing-safe compare.
- Rate-limit and lockout are enforced server-side.
- Challenge is one-time (`status=verified` once consumed).
- Keep callable endpoints behind App Check in production if possible.
