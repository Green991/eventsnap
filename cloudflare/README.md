# Cloudflare R2 setup (EventSnap)

This folder contains the base Worker for signed uploads:

- [`r2-sign-upload-worker.js`](cloudflare/r2-sign-upload-worker.js:1)

## 1) Create R2 bucket

Create a bucket (example):

- `eventsnap-media`

## 2) Create Worker and bind R2 bucket

In Cloudflare dashboard:

1. Create a Worker.
2. Paste [`r2-sign-upload-worker.js`](cloudflare/r2-sign-upload-worker.js:1).
3. Add R2 binding:
   - Binding name: `EVENTSNAP_MEDIA_BUCKET`
   - Bucket: `eventsnap-media`

## 3) Configure Worker variables/secrets

Add environment variables:

- `PUBLIC_MEDIA_BASE_URL` = public URL base where media is served
  - Example: `https://cdn.tudominio.com`
- `ALLOWED_ORIGINS` = allowed app origins separated by comma
  - Example: `https://eventsnap.app,https://www.eventsnap.app`

Add secret:

- `UPLOAD_SIGNING_SECRET` = long random secret (minimum 32 chars)

## 4) Deploy Worker

Expose endpoint:

- `POST /sign-upload`

Contract expected by frontend is documented in [`README.md`](README.md:135).

## 5) Connect frontend endpoint

Set the Worker URL in:

- [`window.__EVENTSNAP_R2_SIGN_UPLOAD_ENDPOINT__`](public/app.html:227)

Example:

- `https://eventsnap-upload-signer.<tu-subdominio>.workers.dev/sign-upload`

## 6) Activate per-event media provider

Switch event provider to `r2` from dashboard UI:

- [`mediaProviderInput`](public/dashboard.html:173)
- Save button handled in [`saveMediaProviderBtn`](public/js/dashboard.js:571)

The app upload flow then uses:

- [`uploadMediaFile()`](public/js/app.js:542)

with automatic fallback to Firebase if R2 fails.

## 7) 30-day cleanup policy

### R2 lifecycle (objects)

Configure R2 lifecycle rule in Cloudflare:

- Prefix: `event_photos/`
- Action: Delete objects after `30` days

### Firestore metadata cleanup

Metadata now stores expiry fields in [`mediaDoc`](public/js/app.js:702):

- `expiresAt`
- `retentionDays`

Recommended cleanup job (daily):

1. Query `events/*/photos` where `expiresAt <= now`.
2. Delete document.
3. Optionally decrement `users.storage_used` if `sizeMB` exists.

## 8) Security notes

- Worker validates media type, content-type, max size and token TTL.
- Token is HMAC-signed server-side in [`signToken()`](cloudflare/r2-sign-upload-worker.js:230).
- Upload endpoint validates token in [`verifyToken()`](cloudflare/r2-sign-upload-worker.js:237).

