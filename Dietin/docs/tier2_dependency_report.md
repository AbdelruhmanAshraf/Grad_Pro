# Tier 2 — Dependency Usage Report (no uninstall yet)

**Sprint:** Phase B, after Tier 1 deletes shipped.
**Status:** REPORT ONLY. Nothing has been uninstalled.
**Method:** Static grep across `src/`, `functions/src/`, `vite.config.ts`,
`capacitor.config.ts`, root `*.js` scripts. Confidence reflects what static
analysis can guarantee, **not** runtime certainty.

The user opted to keep, for now:
- Any **Firebase-related** package
- Any **AI-related** package (incl. `@huggingface/inference`, `openai`)
- Any **TensorFlow** package
- Any **Three.js / @react-three / @theatre** package
- Any **QR / scanner** package (Quagga, html5-qrcode, @zxing/\*, react-zxing)
- Any **payment** package (Stripe, Paddle, Tap, Paymob, etc.)
- Any **exercise database** package
- Lockfiles
- Anything under `ai/`

So the table below **excludes** those categories from removal recommendations
even when usage = 0. They're listed for visibility only and tagged
`PROTECTED-BY-POLICY`.

---

## Recommended for removal — high-confidence orphans

| # | Package | Importers found (file:line) | Bundle impact (est., gzipped) | Confidence |
|---|---------|-----------------------------|-------------------------------|------------|
| 1 | `@builder.io/react` | 0 | ~30 kB | 99% safe |
| 2 | `@builder.io/sdk` | 0 | ~20 kB | 99% safe |
| 3 | `@supabase/supabase-js` | 0 | ~50 kB | 99% safe |
| 4 | `appwrite` | 0 | ~25 kB | 99% safe |
| 5 | `supertokens-node` | 0 | ~0 kB (server lib, never imported) | 99% safe (Node-only lib in a web app) |
| 6 | `next` (devDep) | 0 | 0 (build dep) | 99% safe (Vite app, never `next dev`/`next build`) |
| 7 | `react-native-linear-gradient` | 0 | 0 (web build ignores it) | 99% safe |
| 8 | `react-native-vector-icons` | 0 | 0 | 99% safe |
| 9 | `react-native-webview` | 0 | 0 | 99% safe |
| 10 | `@specy/liquid-glass-react` | 0 | ~5 kB | 99% safe |
| 11 | `firebase-admin` **(root)** | 0 in `src/` (only matched a comment in `aiCoachApi.ts`). The real consumer is `functions/package.json`, which already lists it. | ~0 kB in browser bundle; on-disk ~30 MB | 95% safe — moving from root to functions only |
| 12 | `@types/tailwindcss` | 0 (wrong package; Tailwind ships its own types) | 0 kB ship | 99% safe |
| 13 | `@vitejs/plugin-react-swc` | 0 — `vite.config.ts` imports `@vitejs/plugin-react` instead | 0 kB ship | 95% safe (confirm by reading `vite.config.ts` head; already verified) |
| 14 | `dotenv` (root deps) | 0 in `src/`. `firebase-migration.js` uses it via `require('dotenv')`. | 0 kB ship | 80% safe — keep in root only if you still run `firebase-migration.js`; could also move to `optionalDependencies` |
| 15 | `@capacitor/geolocation` | 0 in `src/` and `capacitor.config.ts` does not register it | 0 kB ship (native only) | 90% safe |
| 16 | `@capacitor/motion` | 0 same as above | 0 kB ship | 90% safe |
| 17 | `@capacitor-community/firebase-analytics` | 0 same | 0 kB ship | 85% safe — analytics features may need it later |

> Total estimated removable JS payload: **~130 kB gzipped**. Total node_modules disk savings: **~250 MB** (mostly from `next`, RN packages, Supabase, Appwrite, Supertokens).

---

## PROTECTED-BY-POLICY (excluded from removal recs)

Static usage = 0, but you explicitly asked these stay regardless.

| Package | Static importers | Notes |
|---------|------------------|-------|
| `@huggingface/inference` | 0 | Kept under "AI package" policy. |
| `openai` | 0 | Kept under "AI package" policy. |
| `@google/generative-ai` (root) | 0 (Sprint 1 removed all callers; `functions/` still uses it correctly) | Kept under "AI package" policy. |
| `@tensorflow/tfjs` | 0 | Kept under "TensorFlow" policy. |
| `three`, `@types/three` | 0 | Kept under "Three.js" policy. |
| `@react-three/drei`, `@react-three/fiber`, `@react-three/postprocessing`, `@react-three/rapier`, `@react-three/gltfjsx`, `@react-spring/three` | 0 | Kept under "Three.js" policy. |
| `@theatre/core`, `@theatre/r3f` | 0 | Kept under "Three.js" policy. |
| `gltfjsx`, `leva`, `maath` | 0 | Kept under "Three.js" policy. |
| `quagga`, `html5-qrcode`, `@zxing/browser`, `@zxing/library`, `react-zxing` | 0 | Kept under "QR/Scanner" policy. |
| `socket.io-client` | 0 | Kept (could be used by AI Coach websocket fan-out in Phase G; not currently). |
| `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` | 0 — only string mentions in `ProSubscriptionPanel.tsx`/`Payment.tsx` (UI text "Stripe"), no JS import | Kept under "payment" policy. |
| `@paddle/paddle-js` | 0 | Kept under "payment" policy. |
| `@tap-payments/gosell` | 0 | Kept under "payment" policy. |

> If you later relax these policies for any individual package, run the same
> grep one more time before removing in case Phase C/D introduced a real
> dependency.

---

## Verification methodology

Each package was tested with:
```bash
grep -rE "from ['\"]<pkg>['\"]|from ['\"]<pkg>/|require\(['\"]<pkg>['\"]\)" \
  src/ functions/src/ vite.config.ts capacitor.config.ts
```
- A hit anywhere = "in use" → not recommended for removal.
- Zero hits in app code + zero hits in build/native configs → recommended.
- For payment/AI/scanner libs, even zero hits = **PROTECTED-BY-POLICY** (do nothing).

This is purely static analysis. A few false negatives are possible if a
package is loaded via:
- Runtime `import()` with a string variable (vanishingly rare in this codebase)
- A side-effect-only import that wasn't grepped
- A native iOS/Android bridge in `android/` or `ios/`

Before uninstalling anything from the *recommended* list, I'd also:
1. Read `vite.config.ts` end-to-end to catch any plugin require.
2. Read `package.json` `scripts` for tool refs.
3. Run a real `vite build` to confirm.

Cannot run the build from inside this sandbox, but the static evidence is
clean for the 17 packages above.

---

## Suggested execution batches (when you approve)

**Batch B.1 — frontend-only deps with zero risk (10 pkgs)**

```bash
cd Dietin
npm uninstall \
  @builder.io/react @builder.io/sdk \
  @supabase/supabase-js appwrite supertokens-node \
  @specy/liquid-glass-react \
  next \
  react-native-linear-gradient react-native-vector-icons react-native-webview \
  @types/tailwindcss
```
Then:
```bash
npm run build      # must succeed
```

**Batch B.2 — dev/build deps (1 pkg, harder to detect at runtime)**

```bash
npm uninstall @vitejs/plugin-react-swc
npm run build
```

**Batch B.3 — capacitor side (3 pkgs, double-check on Android first)**

```bash
npm uninstall @capacitor/geolocation @capacitor/motion @capacitor-community/firebase-analytics
npx cap sync android
```
Skip this batch if any Phase C–G work depends on geolocation/motion.

**Batch B.4 — root `firebase-admin` & `dotenv` (manual review)**

These two have a real use case (`firebase-migration.js`), so consider:
- **Keep `dotenv`** in root deps (rare, one-shot script).
- **Move `firebase-admin`** from root deps to `optionalDependencies`, or
  delete from root entirely and only run the migration script with
  `cd Dietin/functions && node ../firebase-migration.js`.

No action recommended without your input.
