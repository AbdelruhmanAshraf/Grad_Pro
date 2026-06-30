# Security Audit — Phase A Hardening

**Scope:** Dietin web app (Vite/React) + Firebase Cloud Functions + FastAPI
Exercise Recognition module.
**Date:** 2026-06-30
**Sprint:** Phase A of the multi-phase production hardening plan.

This document describes every security change made during Sprint 1, the
vulnerabilities they close, and the residual work still required.

---

## 1. Executive summary

Before this sprint the app shipped **two hardcoded Gemini API keys** (one
server-side, one bundled into the browser), tracked `.env.development` and
`.env.production` in Git (Firebase Web SDK config + a plaintext test-user
password), exposed an unauthenticated FastAPI server, served the SPA with
`Access-Control-Allow-Origin: *`, and had no Content-Security-Policy. The
Firestore rules let any signed-in user reset their own AI quota counters,
trivially bypassing the daily limit.

After this sprint:
- All Gemini calls go through authenticated Cloud Function proxies; the
  browser cannot reach Gemini directly.
- Secrets live exclusively in `.env` files that are `.gitignore`d, with
  `.env.example` templates committed.
- The FastAPI server requires a verified Firebase ID token on every
  protected route, enforces per-user rate limits, caps payload size, and
  evicts stale sessions.
- Firestore rules treat AI quota counters and entitlement fields as
  server-only.
- Storage rules enforce per-file size caps and a content-type allowlist.
- The SPA ships with a strict CSP, no wildcard CORS, HSTS, and a
  Permissions-Policy.

---

## 2. Vulnerabilities found

| # | Severity | Component | Description |
|---|----------|-----------|-------------|
| V1 | **Critical** | `functions/src/index.ts:225` | Gemini API key hardcoded as a string literal in source. Anyone with repo read access could exfiltrate it. |
| V2 | **Critical** | `src/lib/gemini.ts:8` | Gemini API key hardcoded **client-side** and bundled into the production JS shipped to every browser. Stealing it required loading the app once. |
| V3 | **High** | `.env.development`, `.env.production` | Both files tracked in Git with the Firebase Web config and the unused `VITE_TEST_USER_PASSWORD=abdo12345`. Even though Firebase Web keys are not strictly secret, embedding test-user credentials in a public file is a credential leak. |
| V4 | **High** | `firebase-migration.js` | Two Firebase Web SDK configs (old + new project) hardcoded inline. Made the file unreusable safely. |
| V5 | **High** | `ai/exercise_recognition/inference/app/api.py` | Every endpoint (`/api/session/start`, `/api/frame`, `/api/session/status`, `/api/session/end`, `/api/exercises`) was unauthenticated. Any caller could open sessions, push frames, and exhaust the model worker. |
| V6 | **High** | `ai/.../sessions.py` | In-memory `_sessions: Dict[str, WorkoutSession]` never expired. Repeated session-start calls leaked memory until the process OOMed. |
| V7 | **High** | `ai/.../api.py` (no payload guard) | `FrameRequest.image` was unbounded; a single base64 string could be hundreds of MB before pydantic rejected it. |
| V8 | **High** | `firestore.rules` user doc | `update` rule blocked only `isPro/proExpiresAt/plan/subscriptionId` from client mutation but allowed clients to write the AI quota counters (`dailyMealAnalysisCount`, `dailyImageAnalysisCount`, …). Resetting them gave free unlimited AI usage. |
| V9 | **High** | `.htaccess` | `Access-Control-Allow-Origin: *` on every response combined with `Access-Control-Allow-Credentials` semantics in some downstream code = potential for credentialed CSRF / data exfiltration. |
| V10 | **Medium** | `.htaccess` | No Content-Security-Policy, no Permissions-Policy, no HSTS. |
| V11 | **Medium** | `storage.rules` | `profilePictures/` and `mealImages/` had no size cap and no content-type check — bucket could be abused as a free file host. |
| V12 | **Medium** | Cloud Function `analyze_image_food` | Image base64 input was unbounded and mime-type came straight from the client. |
| V13 | **Medium** | Cloud Functions | No output sanitization of Gemini text returned to clients (control characters, unbounded length). |
| V14 | **Low** | Cloud Functions | All secrets read via the **deprecated** `functions.config()` API. |

---

## 3. Fixes

### 3.1 Secrets are now env-only

- Added `.env.example` (frontend Vite template) at the repo root listing only
  the keys, never values.
- Added `functions/.env.example` covering `GEMINI_API_KEY`, `GEMINI_MODEL`,
  Paymob credentials, app URLs, allowed CORS origins.
- Added `functions/.env` (local dev secret store) — **gitignored** —
  containing the new Gemini key.
- Replaced the hardcoded `GEMINI_API_KEY` string literal in
  `functions/src/index.ts` with `process.env.GEMINI_API_KEY`; added
  `requireGemini()` so the function fails closed (HTTP 412
  `failed-precondition`) when the key is missing instead of crashing.
- Rewrote `src/lib/gemini.ts`. The browser no longer imports
  `@google/generative-ai`. A `Proxy`-based `genAI` export throws
  `[security] Direct Gemini client SDK access removed.` if any module
  tries to reach for the old surface.
- Rewrote `firebase-migration.js` to require every Firebase config field
  via `process.env`; missing env aborts the script.
- Updated `.gitignore` to cover `.env`, `.env.local`, `.env.development`,
  `.env.production`, `.env.test`, `.env.staging`, `.env.*.local`,
  `functions/.env`, `functions/.runtimeconfig.json`,
  `ai/exercise_recognition/.env`.

**Manual follow-up required (sandbox blocks `git rm --cached`):**

```bash
cd Dietin
git rm --cached .env.development .env.production
git commit -m "chore(security): untrack env files (now gitignored)"
# Then rotate the Firebase Web API key in Google Cloud Console
# (Firebase Web keys are restrictable via referrer + API restrictions).
```

### 3.2 Gemini is server-side only

| Endpoint | Inputs | Output | Notes |
|----------|--------|--------|-------|
| `gemini_generate` | `prompt`, optional `system`, optional `model`, optional `image: { data, mimeType }` | sanitized text | Default quota bucket `textgen` (10/day) or `image` (1/day) when image attached. |
| `gemini_generate_json` | same | parsed `json` | Forces `responseMimeType=application/json`, validates JSON.parse before returning. |
| `analyze_food` (existing) | `description` (≤2000 chars) | nutrition JSON | Input now sanitized + length-capped. |
| `analyze_image_food` (existing) | `imageBase64` (≤6 MB encoded), `mimeType` (allowlist) | description | Allowed mimes: `image/jpeg|png|webp|heic`. |

Every callable:
- Rejects unauthenticated callers (`context.auth` check).
- Calls `checkQuota(uid, type)` inside a Firestore transaction.
- Sanitizes inputs (control chars stripped, `system:`/`assistant:` prompt
  prefixes neutralised, length capped, ` ``` ` fences neutralised).
- Sanitizes outputs (control chars stripped, length capped at 8000 chars).
- Only allows model id `gemini-2.0-flash` (allowlist; unknown ids fall
  back to the env default).

Client lib `src/lib/gemini.ts` now exposes `generateText()`,
`generateJSON<T>()`, `analyzeNutrition()`, `analyzeImage()`. All eight
former direct-Gemini callers were rewritten:

```
src/lib/gemini.ts                           — rewritten core wrapper
src/components/NameValidationAI.tsx         — JSON validation via proxy
src/components/MealAnalysis.tsx             — 4 sites → JSON + image proxy
src/components/MealSuggestionsAI.tsx        — 2 sites → JSON proxy
src/components/hydration ai.tsx             — 2 sites → JSON proxy
src/features/progress/sections/WeeklyReportSection.tsx — text proxy
src/pages/Burn.tsx                          — JSON proxy
src/pages/Diet.tsx                          — unused import removed
src/pages/Plan.tsx                          — text proxy
```

Verification grep returns zero hits in `src/`:

```bash
grep -rnE "GoogleGenerativeAI|@google/generative-ai|genAI\.|getGenerativeModel" src/
# (no output)
```

### 3.3 FastAPI Exercise Recognition hardening

New module `ai/exercise_recognition/inference/app/security.py`:

- `firebase_user()` FastAPI dependency: verifies
  `Authorization: Bearer <id-token>` against firebase-admin. Falls back to
  an anonymous uid only when `AI_ALLOW_ANONYMOUS=1` is set (dev only).
- `RateLimiter`: in-memory per-uid sliding window. Two scopes:
  - `frame` — default 60 req / 30 s (configurable via env)
  - `session` — default 30 req / 60 s
- `assert_payload_size`: rejects requests where `Content-Length` exceeds
  `AI_MAX_BODY_BYTES` (default 4 MB).

`api.py` rewritten:

- Every protected route (`/api/exercises`, `/api/session/start`,
  `/api/frame`, `/api/session/status`, `/api/session/end`) requires a
  verified Firebase user.
- `/api/health` remains unauthenticated by design (liveness probe).
- `/api/frame` adds `assert_payload_size` so an 800 MB base64 frame is
  rejected immediately without ever reaching MediaPipe.
- All session endpoints invoke `_assert_owner(session, user)` — sessions
  are bound to their creator's uid and cannot be hijacked.
- CORS middleware now restricts methods to `GET, POST, OPTIONS` and
  headers to `Authorization, Content-Type, Accept` (was `["*"]`).
- CORS origins are env-driven via `AI_CORS_ORIGINS`; the previous
  hard-coded localhost list is the fallback when the env is empty.
- A background asyncio task sweeps stale sessions every
  `session_cleanup_interval_s` (default 60 s). Eviction criteria:
  - idle > `session_idle_timeout_s` (default 600 s), OR
  - lifetime > `session_max_age_s` (default 4 h), OR
  - ended_at > 5 min ago.

`sessions.py`:
- `WorkoutSession` gained `owner_uid` and `last_activity_at`.
- `SessionManager.start()` takes `owner_uid`.
- `SessionManager.touch()` bumps `last_activity_at` on every frame.
- `SessionManager.sweep_stale()` implements the cleanup logic.

`requirements.txt`: pinned `firebase-admin==6.5.0`.

Client `src/lib/aiCoachApi.ts`: every `aiFetch()` call now resolves
`auth.currentUser.getIdToken()` and attaches
`Authorization: Bearer <id-token>`.

### 3.4 Firestore rules

`firestore.rules` rewritten:
- `users/{uid}` `update` now blocks the **server-only field allowlist**:
  - Subscription/entitlement: `isPro`, `proExpiresAt`, `plan`, `subscriptionId`
  - **AI quota counters** (closes V8): `dailyMealAnalysisCount`,
    `dailyMealAnalysisDate`, `dailyImageAnalysisCount`,
    `dailyImageAnalysisDate`, `dailyWorkoutAnalysisCount`,
    `dailyWorkoutAnalysisDate`, `dailyHydrationAnalysisCount`,
    `dailyHydrationAnalysisDate`, `dailyTextGenAnalysisCount`,
    `dailyTextGenAnalysisDate`.
- `users/{uid}` `create` also rejects payloads that include any
  server-only field.
- User doc payload size capped at < 200 top-level keys (defense-in-depth
  against unbounded field spam).
- Nested subcollections under `users/{uid}` are explicitly owner-only at
  any depth via `match /{path=**}`.
- `subscriptions/{id}` reads remain owner-scoped; all writes are denied
  for clients (Admin SDK bypasses).
- Default-deny terminator unchanged.

### 3.5 Storage rules

`storage.rules` rewritten:
- All write rules now require `isImage()` (allowlist:
  `image/(jpeg|png|webp|heic|gif)`) and a size cap:
  - `profilePictures/{uid}/**` — public read, owner write, ≤2 MB
  - `mealImages/{uid}/**` — owner only, ≤5 MB
  - `progressPhotos/{uid}/**` — owner only, ≤5 MB
- Explicit `delete` rule on all three buckets (was implicit `write` → now
  explicit owner-only).
- Default-deny terminator unchanged.

### 3.6 Security headers + CORS (SPA)

`.htaccess` rewritten:
- Removed `Access-Control-Allow-Origin: *`.
- Added a `SetEnvIf Origin` allowlist that only echoes back trusted
  origins (`https://dietin-web.web.app`, `https://dietin-web.firebaseapp.com`,
  `https://dietin.app`, `https://www.dietin.app`, and the standard local
  dev ports 3000/3001/5173/5174/8080).
- Added `Vary: Origin` so caches differentiate by origin.
- Removed deprecated `X-XSS-Protection`.
- Added:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=(self), payment=(self)`
  - `Content-Security-Policy` (see below).

#### CSP

```
default-src 'self';
script-src  'self' 'unsafe-inline' 'unsafe-eval'
            https://www.gstatic.com https://apis.google.com
            https://*.firebaseio.com https://*.googleapis.com
            https://accept.paymob.com https://js.stripe.com
            https://cdn.paddle.com https://www.googletagmanager.com
            https://www.google-analytics.com;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src    'self' https://fonts.gstatic.com data:;
img-src     'self' data: blob: https:;
media-src   'self' blob:;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com
            https://firebasestorage.googleapis.com
            https://identitytoolkit.googleapis.com
            https://securetoken.googleapis.com
            https://generativelanguage.googleapis.com
            https://accept.paymob.com https://api.stripe.com
            https://*.run.app wss:;
frame-src   'self' https://accept.paymob.com https://js.stripe.com
            https://*.firebaseapp.com;
object-src  'none';
base-uri    'self';
form-action 'self';
frame-ancestors 'self';
upgrade-insecure-requests
```

`'unsafe-inline'` + `'unsafe-eval'` are required by the current Vite
production bundle (PWA service worker, Stripe Elements, Three.js shader
eval). Removing them is a Phase I (perf/cleanup) task that requires
nonce-based CSP and a Vite plugin change.

---

## 4. Residual risks / Phase A.1 follow-up

| ID | Risk | Owner action |
|----|------|--------------|
| R1 | The two Gemini keys (`AIzaSyDxwvUw4...`, `AIzaSyD0bFaY...`) and the Firebase Web key were committed to Git history. Removing them from the working tree does not remove them from history. | Run **`git filter-repo`** (or BFG) on the upstream repo to scrub the keys from history; rotate the affected keys (Gemini + Firebase Web) in the Google Cloud Console regardless. |
| R2 | The `AQ.Ab8R...` Gemini key the user pasted into the chat is technically in transcript history. | Rotate that key once Sprint 1 is verified working, and put the rotated value in `functions/.env`. |
| R3 | CSP still includes `'unsafe-inline'` + `'unsafe-eval'`. | Phase I: move to nonce-based CSP via the Vite plugin. |
| R4 | The Cloud Function still uses the legacy v1 `functions.https.onCall` API (`functions.config()` reads for Paymob remain as a fallback). | Migrate to Functions v2 + `defineSecret` so `firebase functions:secrets:set` becomes the single source of truth for production secrets. |
| R5 | The FastAPI rate limiter is in-memory and per-instance. | When the API gets horizontally scaled, switch to a Redis-backed limiter (e.g. `slowapi`+Redis) and a Redis session store. |
| R6 | Firebase ID-token verification in FastAPI uses Application Default Credentials. | For production deploy, mount a service-account JSON at `GOOGLE_APPLICATION_CREDENTIALS` or use Workload Identity. |
| R7 | Storage size limits in `storage.rules` are per-file. There is still no per-user **total** quota. | Phase D (Progress Photos) should add a Cloud Function trigger that aggregates bytes used per user and surfaces a quota error in the UI before upload. |
| R8 | The 2 untracked env files (`.env.development`, `.env.production`) still exist in Git history and would be re-committed if someone overrode `.gitignore` with `git add -f`. | Run the manual `git rm --cached` listed in §3.1 and merge it before pushing. |
| R9 | The `firebase-messaging-sw.js` service worker still hardcodes Firebase Web config because SWs cannot read Vite env vars. | Acceptable — Firebase Web SDK config is technically public (security is enforced by rules), but a future hardening pass can have Vite emit the SW from a template. |

---

## 5. Before / after metrics

| Metric | Before | After |
|--------|--------|-------|
| Gemini API keys in source | 2 (functions + browser bundle) | 0 |
| Firebase Web config hardcoded in source files | 4 (migration script + SW + 2 envs) | 1 (service worker only, by design) |
| Tracked `.env.*` files with values | 2 | 0 (after the manual `git rm --cached`) |
| Cloud Function endpoints touching Gemini | 2 (`analyze_food`, `analyze_image_food`) | 4 (`+ gemini_generate`, `+ gemini_generate_json`) |
| Client files importing `@google/generative-ai` | 9 | 0 |
| FastAPI routes without auth | 5 | 0 protected (1 health route exempted by design) |
| FastAPI payload cap | none | 4 MB |
| FastAPI per-user rate limit | none | 60/30s (frames), 30/60s (sessions) |
| FastAPI session expiry | never | 10 min idle / 4 h absolute |
| Firestore client-writeable server fields | partial (only entitlement) | full (entitlement + 10 quota counters) |
| Storage write content-type check | partial (progressPhotos only) | all 3 buckets |
| Storage write size cap | partial (progressPhotos only) | all 3 buckets |
| CORS allowlist | `*` | 4 production origins + 5 dev ports |
| Security headers present | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, deprecated `X-XSS-Protection` | + CSP, + HSTS, + Permissions-Policy (also removed deprecated X-XSS-Protection) |

---

## 6. Files touched

```
Added:
  Dietin/.env.example
  Dietin/functions/.env.example
  Dietin/functions/.env                     (gitignored)
  Dietin/ai/exercise_recognition/inference/app/security.py
  Dietin/docs/security_audit_after_fix.md   (this file)

Modified:
  Dietin/.gitignore
  Dietin/.env.development                   (stripped VITE_TEST_USER_*)
  Dietin/.env.production
  Dietin/.htaccess
  Dietin/firestore.rules
  Dietin/storage.rules
  Dietin/firebase-migration.js
  Dietin/public/firebase-messaging-sw.js
  Dietin/functions/src/index.ts
  Dietin/src/lib/gemini.ts
  Dietin/src/lib/aiCoachApi.ts
  Dietin/src/components/NameValidationAI.tsx
  Dietin/src/components/MealAnalysis.tsx
  Dietin/src/components/MealSuggestionsAI.tsx
  Dietin/src/components/hydration ai.tsx
  Dietin/src/features/progress/sections/WeeklyReportSection.tsx
  Dietin/src/pages/Burn.tsx
  Dietin/src/pages/Diet.tsx
  Dietin/src/pages/Plan.tsx
  Dietin/ai/exercise_recognition/config.py
  Dietin/ai/exercise_recognition/requirements.txt
  Dietin/ai/exercise_recognition/inference/app/api.py
  Dietin/ai/exercise_recognition/inference/app/services/sessions.py
```

---

## 7. Deploy checklist

Before pushing Sprint 1 to production:

1. **Run the untrack command** (sandbox blocked it):
   ```bash
   cd Dietin
   git rm --cached .env.development .env.production
   ```
2. **Rotate keys** in Google Cloud Console:
   - Firebase Web API key (`AIzaSyDnGBI6E-...`) — restrict to allowed
     referrers in API restrictions UI.
   - Both old Gemini keys (`AIzaSyDxwvUw4...`, `AIzaSyD0bFaY...`) —
     **revoke**.
   - The new key the user pasted in chat (`AQ.Ab8R...`) — rotate again
     after Sprint 1 verification.
3. **Set Cloud Function secrets** for production:
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set PAYMOB_API_KEY
   firebase functions:secrets:set PAYMOB_HMAC_SECRET
   firebase functions:secrets:set PAYMOB_INTEGRATION_ID
   firebase functions:secrets:set PAYMOB_IFRAME_ID
   ```
   Then deploy:
   ```bash
   cd Dietin/functions
   npm run build
   firebase deploy --only functions
   ```
4. **Deploy security rules**:
   ```bash
   cd Dietin
   firebase deploy --only firestore:rules,storage
   ```
5. **Deploy FastAPI** with the right env:
   ```bash
   AI_CORS_ORIGINS=https://dietin-web.web.app,https://dietin.app \
   GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/sa.json \
   AI_ALLOW_ANONYMOUS=0 \
   uvicorn app.api:app --host 0.0.0.0 --port 8000 --workers 2
   ```
6. **Smoke test**:
   - Open the SPA, log in, run a meal analysis → quota counter increments
     server-side; client cannot reset it.
   - Open the AI Coach page; verify the `Authorization: Bearer …` header
     is attached to every `/api/*` request.
   - Confirm CSP report-only mode for 24 h before enforcing if you want a
     safer rollout.
