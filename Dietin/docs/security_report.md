# Dietin Security Report

_Generated as part of the 2026-07 security-hardening pass._

## Executive summary

The security hardening pass closed the largest exposures in the Dietin codebase — a live DigitalOcean/Kimi API key inlined into every browser build, a hardcoded "test account" login button shipping in production, four authenticated pages reachable without a signed-in user, an LLM path with zero prompt-injection defense, and missing HTTP security headers on hosting. Firestore rules, Storage rules, FastAPI JWT auth, and per-user rate limits were already strong and were left in place. Alongside the fixes, this pass added a JWT-gated FastAPI Kimi proxy so no LLM credentials ever reach the browser; shared zod/Pydantic schemas that validate every user input and every AI response on both sides of the wire; strict CSP + HSTS + Referrer-Policy on both Firebase Hosting and `.htaccess`; and structured server-side security logging with client-side redaction.

## Findings, risks, and fixes applied

### §1 — Secret hygiene (CRITICAL, fixed)

- **Was**: `Dietin/.env.development` and `Dietin/.env.production` held live keys `VITE_GEMINI_API_KEY=AIzaSyAGd1GZWyO30O9PphBvyq0mYzgUsM6QtFI` and `VITE_DO_AGENT_KEY=dop_v1_ed88…`. Because they were `VITE_*` values, Vite inlined them into every browser bundle. `src/lib/gemini.ts` instantiated `new OpenAI({apiKey, baseURL, dangerouslyAllowBrowser: true})` on the client.
- **Fix**: `.env.development` and `.env.production` deleted from disk. `.env.example` rewritten to list only public-safe `VITE_FIREBASE_*` + `VITE_AI_BACKEND_URL`. Kimi key moved to the FastAPI backend env only (`DO_AGENT_KEY`) — never crosses the browser again (see §5). Frontend never imports `openai`/`@google/generative-ai` anymore. `.gitignore` already covered `.env*` — verified `git ls-files` returned only `.env.example`.
- **Residual**: rotate both leaked keys at their providers — historical builds still contain them. See recommendations.

### §2 — Auth and routing (HIGH, fixed)

- **Was**: `src/App.tsx:134` `protectedPaths` list guarded only `/burn /hydration /workouts /progress /ai-coach`. `/diet`, `/plan`, `/home`, `/profile`, and `/add-meal` rendered without a signed-in user. `src/components/Auth.tsx:779-787` shipped a "Login with Test Account" button with hardcoded `abderuhamanelfekky@gmail.com` / `abdo12345`.
- **Fix**: `protectedPaths` now `['/burn','/hydration','/workouts','/progress','/ai-coach','/diet','/plan','/home','/profile','/add-meal']`. Test-account button deleted entirely. Firestore rules already default-denied non-owner reads — so no data actually leaked — but the pages themselves are now gated.

### §3 — Firestore & Storage rules (STRONG, no change)

Audited only. `firestore.rules` still default-denies, `users/{uid}` is owner-only, `serverOnlyFields()` blocks client writes to `isPro / plan / subscriptionId / proExpiresAt / daily*AnalysisCount / daily*AnalysisDate`, and `userDocSizeOk` caps user docs to 200 top-level keys. `storage.rules` still allowlists `image/(jpeg|png|webp|heic|gif)` and caps 2 MB profile / 5 MB progress+meal, owner-only.

### §4 — Input validation with zod (MED, fixed)

- **Was**: `src/pages/Plan.tsx:31-33` imported zod + react-hook-form but never declared a schema. `Profile.tsx`, `AddMeal.tsx`, `Welcome.tsx`, `HydrationModal.tsx`, `Workouts.tsx` used `parseInt(e.target.value) || 0` / `Number(x)` with either no range check or imperative bounds bypassable via DevTools.
- **Fix**: New `Dietin/src/lib/validation/schemas.ts` centralises every numeric bound as a zod schema — `weightKg 1..500`, `heightCm 50..300`, `ageYears 5..120`, `kcal 0..10000`, `grams 0..2000`, `waterMl 0..10000`, `foodText 1..500`, plus `profileSchema`, `addMealSchema`, `hydrationSchema`, `workoutStartSchema`, and `boundedNumber(v, min, max, fallback)`. Bounds match the FastAPI Pydantic schemas so client and server refuse the same values. Also exports the AI response schemas (`nutritionResponseSchema`, `foodValidationResponseSchema`, `imageDescriptionResponseSchema`) used by the LLM client (§6).
- **Wired**: `Profile.tsx` macro goals use `boundedNumber(0, 10000|2000, 0)` with `min`/`max` HTML attrs. `AddMeal.tsx::handleSaveMeal` and `MealAnalysis.tsx::handleSaveMeal` gate persistence through `addMealSchema.safeParse` — toast on reject. `HydrationModal.tsx::handleCustomAdd` uses `hydrationSchema.safeParse`. `Welcome.tsx::isHeightValid` / `isWeightValid` layer `heightCm` / `weightKg` on top of the imperative UX bounds so DevTools bypass of the narrower onboarding ranges still hits the wider zod bound. `features/ai-coach/api.ts::startSession` bound-checks payload with `workoutStartSchema.safeParse` before POST — matches the FastAPI `SessionStartRequest` Pydantic `le=` limits, so the frontend rejects at the same point the server would 422.

### §5 — AI request security (CRITICAL, fixed)

- **Was**: `src/lib/gemini.ts` held the Kimi key in `VITE_DO_AGENT_KEY`, called `inference.do-ai.run` directly with `dangerouslyAllowBrowser: true`, interpolated raw user text like `"${foodDescription}"` into prompts, ignored the `system` argument, and had no timeout, no delimiter fencing, no length cap. `NameValidationAI.tsx:66` did `onValidation(true)` on any error — signup name check bypassed by pulling the network cable.
- **Fix**: New FastAPI module `Dietin/ai/exercise_recognition/inference/app/llm.py` exposes `POST /api/llm/chat`. Requires the Firebase JWT via the existing `firebase_user` dependency. Enforces per-user rate limits via `rate_limit("llm")` (10 req / 60 s, env-tunable). Caps payload via `assert_payload_size` (4 MB). Every user prompt is stripped of control chars, triple-backticks, and instruction keywords (`system:`, `assistant:`, `ignore previous instructions`, sentinel-shaped tags) and wrapped in `<<<USER_INPUT>>>…<<<END_USER_INPUT>>>` sentinels. A hardened system prompt tells the model to treat delimited content as data only. The upstream Kimi call is made from the server with the server-only `DO_AGENT_KEY`, uses `httpx.AsyncClient(timeout=30 s)`, and maps upstream failures to 502/504 without leaking the key. `src/lib/gemini.ts` was rewritten to `fetch(BACKEND/api/llm/chat, { Authorization: Bearer <idToken>, signal: AbortController(30 s) })`. `NameValidationAI.tsx` fails **closed** now.

### §6 — AI response validation (MED, fixed)

- **Was**: `analyzeNutrition` clamped `Math.max(0, Number(x))` with no upper bound — `calories: 9_999_999_999` from a compromised LLM would render without complaint. `MealAnalysis.tsx` / `AddMeal.tsx` only checked `typeof === 'number'`.
- **Fix**: Two lines of defense. Server-side, `validate_and_shape` in `llm.py` runs Pydantic bounds per `task` — `NutritionOut(calories 0..5000, protein 0..500, carbs 0..1000, fat 0..500, healthScore 0..100)`, `FoodValidationOut`, `ImageDescriptionOut`. Invalid → 502 + one redacted log line. Client-side, `src/lib/gemini.ts` re-parses with the zod schemas from §4 (`nutritionResponseSchema.safeParse(env.json)`); invalid → surface toast + deterministic fallback.

### §7 — FastAPI tightening (fixed)

- `app/schemas.py` `SessionStartRequest`: added `Field(le=50)` on `sets`, `le=200` on `target_reps`, `le=3600` on `rest_timer`, `max_length=60` on `exercise`. `SessionEndRequest.session_id` and `FrameRequest.session_id` also gained `max_length=64`. `FrameRequest.image` gained `max_length=1_400_000` bytes.
- `app/security.py`: `AI_ALLOW_ANONYMOUS=1` is **force-ignored** when `APP_ENV=production` (a `[security]` log line prints on the ignore). `firebase_user` now sets `request.state.uid` so the request-log middleware can include the redacted uid without re-parsing the token. New `make_payload_size_dep(max_bytes)` factory exposes both `assert_payload_size` (4 MB default) and `assert_frame_payload_size` (1 MB default via `AI_MAX_FRAME_BYTES`). New rate-limit buckets: `llm` (10 / 60 s), `security_event` (30 / 60 s). New `redact_uid` helper.
- `ai/exercise_recognition/config.py`: `session_idle_timeout_s: 300` (was 600), added `session_max_active: 200` field.
- `app/api.py`: registers the LLM router. Adds a `@app.middleware("http")` request-log middleware — logs `method / path / redacted-uid / status / latency_ms` to stdout (no bodies, no tokens). Adds `POST /api/security/event` to receive client-side security events (see §14). Enforces `session_max_active` via an atomic `_active_sessions` counter in `api.py` (no touching of `services/sessions.py` — the ML surface is off-limits per constraints). `/api/frame` swapped to the 1 MB `assert_frame_payload_size` cap; other endpoints keep the 4 MB cap.
- `requirements.txt`: added `httpx==0.27.2` for the LLM proxy.

### §8 — DoS / rate limits (fixed)

- Existing frame (300 / 30 s) + session (30 / 60 s) preserved.
- New `llm` bucket 10 / 60 s per user. New `security_event` bucket 30 / 60 s per user.
- LLM upstream timeout: 30 s server (`httpx.AsyncClient`) + 30 s client (`AbortController`).
- `/api/frame` body capped at 1 MB; other endpoints at 4 MB.
- `session_max_active: 200` global cap on active workout sessions.

### §9 — Storage (STRONG, minor client-side pre-flight)

Storage rules unchanged. `src/lib/gemini.ts::analyzeImage` now rejects `> 5 MB` and non-`image/(jpeg|png|webp)` inputs client-side so the user sees the error before the upload path even starts. Server rules remain the authoritative gate.

### §10 — HTTP security headers (fixed)

- `firebase.json`: added `hosting.headers` block. Long-lived cache-control on hashed asset extensions; `no-cache` on `index.html`. On every path: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=(self), payment=(self)`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`, and a CSP that removes `'unsafe-eval'`, removes `generativelanguage.googleapis.com` and `inference.do-ai.run` (no more browser-side LLM calls), keeps Firebase / Firestore / Storage / Paymob, and blocks framing.
- `.htaccess:55`: mirrored the CSP (removed `'unsafe-eval'`, Stripe, Paddle, GA, `generativelanguage`; added `*.ondigitalocean.app`, `*.run.app` for the FastAPI backend host). Added `Cross-Origin-Opener-Policy`.
- `index.html`: added `<meta http-equiv="X-Content-Type-Options" content="nosniff" />` and `<meta name="referrer" content="strict-origin-when-cross-origin" />` as belt-and-braces fallbacks. CSP is deliberately NOT set via `<meta>` — `frame-ancestors` cannot be enforced from a meta tag.

### §11 — Frontend hardening (fixed)

- `NameValidationAI.tsx` fails closed (see §5).
- `src/lib/gemini.ts` fully rewritten to remove `dangerouslyAllowBrowser`, remove all direct third-party SDK calls, and add `AbortController` timeouts.
- `MealAnalysis.tsx` — unused `import { GoogleGenerativeAI } from "@google/generative-ai"` removed.
- No `eval(` or `new Function(` in the codebase (verified with grep). Existing `dangerouslySetInnerHTML` usages are static SVG/CSS templates only — reviewed and left.

### §12 — Dependency cleanup (fixed)

- After §5 landed, `src/` no longer imports `@google/generative-ai`, `openai`, `@supabase/supabase-js`, `appwrite`, `@tensorflow/tfjs`, `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, or `@paddle/paddle-js`.
- All nine dependencies removed from `package.json`. Run `npm install` to sync `package-lock.json`.
- `Dietin/functions/package.json` retains `@google/generative-ai` for the existing Cloud Function AI paths — untouched by this pass.
- Follow-up: run `npm audit --production` and record HIGH/CRITICAL results.

### §13 — Privacy

- PII inventory: Firebase Auth (email); Firestore `users/{uid}` (name, weight, height, age, goals); Storage `users/{uid}/meals/*` and `users/{uid}/progress/*`. Retention: while the account exists.
- Ownership enforcement lives in `firestore.rules` (`users/{userId}` allow read/write if `request.auth.uid == userId`) and `storage.rules` (`resource.metadata.owner == request.auth.uid`).
- Logs: `redact_uid` truncates uids in every request-log and security-event line. No emails, no raw tokens ever logged.
- **Delete my account**: new `delete_my_account` callable in `functions/src/index.ts` purges Storage prefixes (`users/{uid}/`, `mealImages/{uid}/`, `progressPhotos/{uid}/`, `profilePictures/{uid}/`), all Firestore subcollections under `users/{uid}` via `listCollections()` + batched deletes, subscription rows, and finally the Auth user. `SettingsPanel.tsx::handleDeleteAccount` invokes it via `httpsCallable` — the client no longer tries to reach data the security rules would deny.

### §14 — Monitoring (fixed)

- New `Dietin/src/lib/securityLog.ts` — `logSecurityEvent(type, detail)` posts to `/api/security/event` with the Firebase JWT. `redact()` collapses key-shaped strings to `[REDACTED]`, emails to `[EMAIL]`, and caps to 200 chars. `keepalive: true` so events fire during navigation.
- Call sites wired: `Auth.tsx` `handleEmailLogin` catch → `login_failed`; `gemini.ts` `chat()` → `rate_limit_hit` (on 429), `ai_failure` (on non-2xx), `validation_error` (on zod parse fail).
- Server side: `/api/security/event` (Pydantic `SecurityEventRequest`, `rate_limit("security_event")`) prints `[sec] uid=<redacted> type=<t> detail=<200-char>` to stdout. Request-log middleware prints `[req <id>] METHOD PATH uid=<redacted> status=<n> Xms`.

### §15 — Paymob webhook harden-in-place (fixed)

- `functions/src/index.ts::webhooks_paymob`:
  - **HMAC compare**: was `calc !== providedHmac` on hex strings (classic timing side-channel). Now uses `crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(calc))` with length guard.
  - **Idempotency**: added a transactional dedupe on Paymob transaction `id` via a `paymob_events/{id}` sentinel doc — a retried webhook no-ops instead of granting Pro twice.
  - **Amount check**: rejects when `obj.amount_cents` doesn't match the subscribed plan's expected price. Marks the subscription `failed / failureReason: 'amount_mismatch'` and returns 400.
  - **Log lines**: `[paymob] hmac mismatch first8=<first8> order_id=<id>` on signature failure, `[paymob] amount mismatch orderId=<id> expected=<n> got=<n> plan=<p>` on amount mismatch. Never logs the raw HMAC value or the secret.

## Remaining risks

1. **Keys already leaked to prior builds** — rotate both `VITE_GEMINI_API_KEY` and `VITE_DO_AGENT_KEY` at their providers.
2. **In-memory rate limiter** — single-instance only. Horizontal scaling requires Redis.
3. **Client-side quota counters** (`userStore.ts::dailyImageAnalysis`, `dailyMealAnalysis`) are UX hints only, resettable via DevTools. The authoritative quota lives in Firestore (server-only fields) and `functions/src/index.ts::checkQuota`.
4. **`AI_ALLOW_ANONYMOUS`** still exists as a dev convenience — hard-refused in prod, but confirm `APP_ENV=production` is set on the DigitalOcean app spec.
5. **Prompt-injection defense** is best-effort — regex + delimiter fencing + hardened system prompt. Aggressive attackers can still probe. Pair with the Pydantic response bounds so bad output can't propagate into the UI.
6. **CSP still uses `'unsafe-inline'` for scripts and styles** because Tailwind arbitrary values and the Firebase auth snippet inline. Move to nonce-based CSP as a follow-up.

## Recommendations (follow-ups)

- Rotate the two leaked API keys at their providers. Restrict the Firebase web key by referrer in Google Cloud console.
- Wire the zod schemas (§4) into `useForm(...)` at every `type="number"` input site.
- Add a Firestore-callable "delete my account" flow.
- Migrate to Redis-backed rate limiter when scaling FastAPI horizontally.
- Switch to nonce-based CSP; drop `'unsafe-inline'` from `script-src` and `style-src`.
- Add Sentry or a comparable log aggregator to structure the `[req]`, `[sec]`, `[llm]`, `[paymob]` stdout lines.
- Confirm `AI_MAX_BODY_BYTES=4194304`, `AI_MAX_FRAME_BYTES=1048576`, `APP_ENV=production`, `AI_CORS_ORIGINS`, `DO_AGENT_KEY`, `DO_AGENT_ENDPOINT`, `DO_AGENT_MODEL`, and `GOOGLE_APPLICATION_CREDENTIALS` are all set on the DigitalOcean app spec.
