# Tier 3 — Migration Proposal (no deletion)

**Sprint:** Phase B follow-up.
**Status:** PROPOSAL ONLY. Nothing is deleted, moved, or untracked. You
asked for an analysis pass for each item.
**Per your instructions, the following are explicitly out of scope and not
proposed for any change here:** `dataconnect/`, `dataconnect-generated/`,
`free-exercise-db-main/`, package lockfiles, anything Firebase-related, any
AI/TensorFlow/Three.js/QR/payment package, any exercise database, anything
under `ai/`.

The items below are repository hygiene only — IDE state, build artifacts,
and stray caches.

---

## R1 — IDE / editor scratch dirs (Visual Studio + JetBrains)

| Path | What it is | Why it shouldn't be tracked |
|------|------------|------------------------------|
| `Dietin/.vs/` | Visual Studio per-user solution settings | Per-developer state; conflicts on every commit. |
| `Dietin/.idea/` | JetBrains per-user project settings | Same. Some teams selectively track a small subset; current `.gitignore` already includes `.idea/` but the dir is still **on disk** and may be partially tracked. |

**Proposed action (your call):**
```bash
cd Dietin
git rm -r --cached .vs .idea       # untrack only; leaves them on disk
# .gitignore already covers both — nothing to add
git commit -m "chore: untrack IDE scratch dirs"
```

Risk: zero. Files stay on your disk; just stop being committed.

---

## R2 — Build output committed to repo

| Path | What it is | Why it shouldn't be tracked |
|------|------------|------------------------------|
| `Dietin/dev-dist/` | Vite-PWA dev build output (service worker + workbox + manifests) | Regenerated on every `npm run dev`; produces noisy diffs and contaminates `git blame`. |
| `Dietin/__pycache__/` (project root) | Stray Python bytecode at the repo root, unrelated to the AI module. | Always regenerated; never useful in history. |
| `Dietin/.npm-cache/` | Local npm cache committed by accident | Several MB, never used by anyone else. |
| `Dietin/push.log` | 22 kB ad-hoc git push log | One-off output, not a deliverable. |

**Proposed action (your call):**
```bash
cd Dietin
git rm -r --cached dev-dist __pycache__ .npm-cache push.log
# add to .gitignore (Sprint 1 already covers __pycache__ + dev-dist via patterns)
# explicit, for clarity:
cat >> .gitignore <<'EOF'

# Build outputs / caches
dev-dist/
__pycache__/
.npm-cache/

# Ad-hoc logs
push.log
EOF
git commit -m "chore: untrack build artefacts and local caches"
```

Risk: low. Anyone else cloning the repo will regenerate them on first
`npm run dev` (dev-dist) or never see them at all (the others).

---

## R3 — Duplicate root configs (NOT removed; needs merge decision)

In the Sprint-2 audit two config pairs came up:
- `tailwind.config.cjs` vs `tailwind.config.js`
- `postcss.config.cjs` vs `postcss.config.js`

**Both pairs have different content.** Vite picks the `.cjs` variant first
in ESM packages (this is `"type": "module"`), so the `.js` files are
*currently inert* — but they aren't textual duplicates, so dropping one
silently could lose theme tokens you care about (the `.js` tailwind has
extra `text.*`/`bg.*` palette entries that `.cjs` doesn't).

**Proposed action:** decision required from you, not Phase B. Options:

1. Merge the extras from `tailwind.config.js` into `tailwind.config.cjs`,
   then delete the `.js` files.
2. Convert the project to `"type": "commonjs"` and keep only `.js`.
3. Leave both, accept the duplication.

I have NOT modified either file.

---

## R4 — Files explicitly protected from this proposal

For the record — these were considered and **explicitly left alone** per
your instructions:

| Path | Reason for keeping |
|------|--------------------|
| `dataconnect/` | "exercise database" / "Firebase-related" policy |
| `src/dataconnect-generated/` | Same |
| `free-exercise-db-main/` | "exercise database" policy |
| `bun.lockb`, `package-lock.json` | "package lockfiles" policy |
| `functions/.env`, `functions/.env.example` | Firebase + AI keys |
| `ai/exercise_recognition/**` | "anything under ai/" + "Exercise Recognition" policy |
| `firestore.rules`, `storage.rules`, `firebase.json` | Firebase-related |
| Anything Payment / AI / TensorFlow / Three.js / QR / scanner | Per policy |

---

## R5 — Risk summary

| Action | Reversibility | Blast radius |
|--------|---------------|--------------|
| Untrack `.vs`/`.idea` | trivial (files remain on disk) | per-developer, no runtime effect |
| Untrack `dev-dist`/`__pycache__`/`.npm-cache`/`push.log` | trivial | none — regenerated automatically |
| Merge tailwind/postcss configs | needs visual inspection | could silently change styling tokens |

---

## R6 — Recommendation for next action

If you want any of R1/R2 done, reply:
- **`untrack ide`** → I run R1 only.
- **`untrack artefacts`** → I run R2 only.
- **`untrack all`** → R1 + R2.
- **`skip`** → I do nothing.

For R3 (config merge), I'd rather show you the diff side-by-side first
than auto-merge; that decision touches design tokens.
