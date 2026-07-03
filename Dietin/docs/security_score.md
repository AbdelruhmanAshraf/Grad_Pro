# Dietin Security Score

Weighted rubric — eight categories × 0–10, weight-sum 85, normalised to 100.

## Before / after

| # | Category                                    | Before | After | Weight | Δ (weighted) |
|---|---------------------------------------------|:------:|:-----:|:------:|:------------:|
| 1 | Secret management (env, browser bundle)     |   2    |   9   |  15    | +105         |
| 2 | Auth & authorization (routing, session)     |   5    |   9   |  15    | +60          |
| 3 | Input validation (client + server bounds)   |   3    |   9   |  12    | +72          |
| 4 | Prompt-injection defense                    |   0    |   7   |  10    | +70          |
| 5 | AI response validation                      |   2    |   8   |  10    | +60          |
| 6 | DoS / rate limits / payload caps            |   7    |   9   |  10    | +20          |
| 7 | HTTP security headers / CSP                 |   6    |   9   |   8    | +24          |
| 8 | Monitoring & structured logging             |   1    |   6   |   5    | +25          |
|   | **Weighted total**                          | **272 / 850** | **709 / 850** |    |              |
|   | **Normalised**                              | **32 / 100**  | **83 / 100**  |    |              |

## Category notes

### 1. Secret management — 2 → 9

**Before**: Live Gemini and DigitalOcean/Kimi API keys inlined into every browser bundle via `VITE_GEMINI_API_KEY` / `VITE_DO_AGENT_KEY`. `.env.development` and `.env.production` on disk with real values.

**After**: `.env.development` and `.env.production` deleted. Kimi key moved to the FastAPI backend only (`DO_AGENT_KEY`). Frontend keeps only public-safe `VITE_FIREBASE_*` + `VITE_AI_BACKEND_URL`. `.env.example` documents both frontend and (server-only) backend keys. Not 10/10 because the leaked keys still need to be rotated at their providers.

### 2. Auth & authorization — 5 → 9

**Before**: Only 5 of the authenticated routes were guarded (`/burn /hydration /workouts /progress /ai-coach`). `/diet /plan /home /profile /add-meal` rendered without a session. Hardcoded test-account button shipped to production.

**After**: `protectedPaths` now covers every authed route. Test-account button removed. FastAPI JWT auth verified on every endpoint except `/api/health`. Firestore rules unchanged (already strong — default-deny + owner-only + server-only fields).

### 3. Input validation — 3 → 9

**Before**: `parseInt(e.target.value) || 0` and `Number(x)` everywhere. `Plan.tsx` imported zod but never declared a schema. FastAPI Pydantic had `ge=` but no `le=` on `sets / target_reps / rest_timer`.

**After**: Shared `src/lib/validation/schemas.ts` centralises every numeric bound (weight 1..500 kg, height 50..300 cm, age 5..120, calories 0..10000, water 0..10000 ml) with matching Pydantic bounds on the server. Wired at the persistence boundary — `Profile.tsx` macros clamp via `boundedNumber` + HTML min/max, `AddMeal.tsx` and `MealAnalysis.tsx` gate meal saves through `addMealSchema.safeParse`, `HydrationModal.tsx` uses `hydrationSchema`, `Welcome.tsx` layers `heightCm`/`weightKg` on top of the imperative onboarding bounds so DevTools bypass still hits the schema, and `features/ai-coach/api.ts::startSession` bound-checks with `workoutStartSchema.safeParse` before the wire.

### 4. Prompt-injection defense — 0 → 7

**Before**: Zero defenses. Raw `"${foodDescription}"` interpolation. `system` argument silently ignored.

**After**: Every user string is control-char-stripped, triple-backtick-stripped, instruction-keyword-neutralised, length-capped, then delimiter-fenced in `<<<USER_INPUT>>>…<<<END_USER_INPUT>>>`. Hardened server-side system prompt per task tells the model to treat delimited content as data only. 7/10 not 10/10 because prompt-injection defense is inherently best-effort — pair with the Pydantic response bounds (§5).

### 5. AI response validation — 2 → 8

**Before**: `Math.max(0, Number(x))` clamps with no upper bound. Presence + typeof check only.

**After**: Two lines of defense. Server-side `NutritionOut` / `FoodValidationOut` / `ImageDescriptionOut` Pydantic models with strict bounds (calories 0..5000, protein 0..500, carbs 0..1000, fat 0..500, healthScore 0..100) reject bad LLM output before it leaves the backend. Client-side zod `safeParse` on the same bounds is the belt-and-braces layer.

### 6. DoS / rate limits / payload caps — 7 → 9

**Before**: Existing per-user rate limits + 4 MB global payload cap. Solid baseline.

**After**: New `llm` bucket 10/60 s, `security_event` bucket 30/60 s, tighter 1 MB cap on `/api/frame`, 30-second client + server LLM timeouts, `session_max_active: 200` global cap, session idle timeout 5 min.

### 7. HTTP security headers / CSP — 6 → 9

**Before**: `.htaccess` had a CSP but included `'unsafe-eval'`, Stripe, Paddle, GA, and `generativelanguage.googleapis.com`. `firebase.json` had no `hosting.headers` block at all.

**After**: Both `firebase.json` and `.htaccess` serve the same tight CSP (drops `'unsafe-eval'`, drops direct-to-LLM endpoints, keeps Firebase + Firestore + Storage + Paymob + FastAPI backend). HSTS, XCTO, XFO, Referrer-Policy, Permissions-Policy, and COOP all sent from both hosts. Meta fallbacks in `index.html`. 9/10 because `'unsafe-inline'` is still allowed in script-src / style-src (Tailwind + Firebase auth inline snippet); nonce-based CSP is a follow-up.

### 8. Monitoring & structured logging — 1 → 6

**Before**: Ad-hoc `console.log`. No structured request/security logging server-side.

**After**: Request-log middleware and `/api/security/event` endpoint emit structured `[req]`, `[sec]`, `[llm]`, `[paymob]` lines with redacted uids to stdout — captured by DigitalOcean logs. Client `securityLog.ts` reports `login_failed / ai_failure / rate_limit_hit / validation_error` with API-key and email redaction. Not 10/10 because there's no aggregator (Sentry / Grafana / Datadog) yet — stdout only.

## Improvements summary

- Went from **32/100 → 83/100** (weighted).
- Biggest lifts: prompt-injection defense (0 → 7), input validation (3 → 9), AI response validation (2 → 8), secret management (2 → 9).
- Six of eight categories are now at 8+ / 10. The two below that (monitoring at 6, prompt-injection at 7) are inherently bounded by the "graduation project" scope — a paid log aggregator and nonce-based CSP would each add a point or two, but the return on effort drops off.
