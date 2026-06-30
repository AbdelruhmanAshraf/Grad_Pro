# Cleanup Report — Phase B

**Sprint:** Phase B of the multi-phase production hardening plan.
**Status:** Tier 1 EXECUTED. Tier 2 + Tier 3 reports written (no action taken).
**Date:** 2026-06-30 (Sprint 1.5 follow-up).

---

## 1. Tier 1 — Executed

### 1.1 What was deleted

After per-file verification (static, dynamic, lazy, route, string-ref grep
plus a Firebase-config scan), the following 9 files were removed from the
working tree. Each one had **zero importers** in `src/`, `index.html`,
`vite.config.ts`, `capacitor.config.ts`, and the root configs.

| File | Verification |
|------|--------------|
| `src/pages/LoginPrompt.tsx` | 0 importers; `App.tsx` redirects `/login-prompt` → `/auth` |
| `src/components/Navigation.tsx` | 0 importers (substring hits in unrelated `allowNavigation` state) |
| `src/components/WelcomeExpo.tsx` | 0 importers; React-Native variant, web build never references it |
| `src/lib/store.ts` | 0 importers; duplicate `useUserStore` shadowed by `src/stores/userStore.ts` |
| `src/lib/routes.tsx` | 0 importers; `BottomNav.tsx` imports `@/lib/routes` which resolves to `routes.ts` (kept) |
| `src/lib/notifications.ts` | 0 importers |
| `src/plugins/GoogleSignInPlugin.ts` | 0 importers; native sign-in lives in `Auth.tsx` via `@capacitor-firebase/authentication` |
| `script.js` | 0 importers; legacy static-site bootstrap |
| `style.css` | 0 importers; legacy static-site CSS |

### 1.2 What was KEPT after verification (proposal was wrong)

The original proposal listed 14 Tier-1 candidates. **Five** of them turned
out to be in active use; deleting them would have broken the build. They
are NOT touched:

| File | Why kept |
|------|----------|
| `src/components/MealAnalysisAnimate.tsx` | `MealAnalysis.tsx:12,1131,2179` uses it |
| `src/components/PlusButton.tsx` | `BottomNav.tsx:8,138-140` uses it |
| `src/lib/routes.ts` | `BottomNav.tsx:5` imports `@/lib/routes` which resolves here |
| `src/lib/theme.ts` | `main.tsx:19`, `Profile.tsx:50-51` use it |
| `tailwind.config.js`, `postcss.config.js`, `tsconfig.node.json` | Either content-differs from the `.cjs` sibling (theme tokens) or referenced from `tsconfig.json:5`. See Tier 3 R3 for the config-merge decision. |

### 1.3 Verification before delete

```bash
grep -rln '<candidate-symbol>' src/ index.html vite.config.ts capacitor.config.ts
```

was run for **every** name. Substring false-positives (e.g. `Navigation`
matching `allowNavigation`) were inspected per-line and excluded only after
reading the surrounding code.

### 1.4 Verification AFTER delete

```bash
grep -rln "from.*['\"](@/components/Navigation|@/components/WelcomeExpo|@/pages/LoginPrompt|@/lib/store|@/lib/routes\.tsx|@/lib/notifications|@/plugins/GoogleSignInPlugin)" src/
# zero hits
```

No remaining import points to any deleted module.

### 1.5 Build / TypeScript check

⚠️ **Sandbox limitation:** this session is currently blocked from running
long-running `node` processes (`tsc`, `vite build`). I could not execute
the build directly. **Static-analysis evidence is clean** — the post-delete
grep above returns nothing — but to satisfy your explicit instruction to
"run full TypeScript check" and "run production build", please run these
two commands locally:

```bash
cd Dietin
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: both succeed with no errors. If `tsc` complains, the offending
import is one of the 9 deleted paths listed in §1.1; ping me with the error
and I'll fix it.

### 1.6 Bundle impact (static estimate)

Tier 1 deletions remove ~15 kB of TypeScript source. Real bundle delta
should land near zero on `vite build` (tree-shaking already excluded the
orphans), with the noticeable wins coming from Tier 2 if/when you approve.

---

## 2. Tier 2 — Report only

Written to `docs/tier2_dependency_report.md`.

Summary:

- **17 npm packages** are unimported anywhere in app code and would be safe
  to drop under your standing policy. Examples: `@builder.io/*`,
  `@supabase/supabase-js`, `appwrite`, `supertokens-node`, `next`, three
  `react-native-*` packages, `@specy/liquid-glass-react`, `@types/tailwindcss`,
  `@vitejs/plugin-react-swc` (Vite uses `plugin-react`), root-level
  `firebase-admin`, root-level `dotenv` (only used by the one-shot
  migration script).
- **~25 additional packages** were flagged as static-zero but
  **PROTECTED-BY-POLICY** (AI, TensorFlow, Three.js / @react-three /
  @theatre, QR/scanner, payment SDKs). They are listed for visibility only;
  no removal recommendation is made for them.
- Estimated savings if Batch B.1 (10 zero-risk pkgs) ships: **~130 kB
  gzipped JS**, **~250 MB on disk**.

**Nothing has been uninstalled.** Approve `batch B.1`, `B.2`, `B.3`, or
`B.4` from the Tier 2 report when ready.

---

## 3. Tier 3 — Proposal only

Written to `docs/tier3_migration_proposal.md`.

Summary:

- **R1.** Untrack `.vs/`, `.idea/` (per-developer IDE state).
- **R2.** Untrack `dev-dist/`, `__pycache__/` (project root), `.npm-cache/`,
  `push.log`.
- **R3.** Merge or de-duplicate `tailwind.config.{cjs,js}` and
  `postcss.config.{cjs,js}` — needs your call because content differs
  (theme tokens).
- All the user-protected dirs and files (`dataconnect/`,
  `dataconnect-generated/`, `free-exercise-db-main/`, lockfiles,
  Firebase/AI/TF/Three/QR/payment, `ai/`) are explicitly listed and untouched.

**Nothing has been moved, untracked, or deleted.** Reply
`untrack ide` / `untrack artefacts` / `untrack all` / `skip` to gate R1/R2;
R3 will get a side-by-side diff before any merge.

---

## 4. Sub-reports

| Document | Purpose |
|----------|---------|
| `docs/cleanup_report.md` | **This file.** Master cleanup status. |
| `docs/tier2_dependency_report.md` | Per-package static usage table with confidence and batch plan. |
| `docs/tier3_migration_proposal.md` | Repo hygiene migration plan (no deletion). |
| `docs/security_audit_after_fix.md` | Phase A security report (Sprint 1). |

---

## 5. Phase B status

| Step | Status |
|------|--------|
| Verify each Tier 1 candidate has zero refs | ✅ |
| Delete verified Tier 1 files | ✅ (9 of 14 deleted; 5 kept after reverify) |
| Run TypeScript check + production build | ⚠️ blocked in sandbox — commands documented |
| Fix any broken imports | ✅ (none arose from static recheck) |
| Tier 2 dependency usage report | ✅ |
| Tier 3 migration proposal | ✅ |
| Update master cleanup report | ✅ (this doc) |

---

## 6. Next actions you can take

- Run the two commands in §1.5 to confirm a clean `tsc`/`vite build`.
- Reply with **`batch B.1`** to start the Tier 2 dep prune.
- Reply with **`untrack all`** for the Tier 3 IDE/artifact cleanup.
- Reply with **`Phase C`** to start the Progress Dashboard 2.0 sprint.
