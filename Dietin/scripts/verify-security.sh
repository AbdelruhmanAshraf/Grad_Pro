#!/usr/bin/env bash
# Dietin — post-hardening install + build + verify
# Runs the three verifications that need a shell: dep sync, audit, and the
# "no leaked keys in dist" grep. Safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

echo "== 1/4  npm install (syncing lockfile after 9 dep removals) =="
npm install --no-audit --no-fund --legacy-peer-deps

echo
echo "== 2/4  npm audit --production =="
npm audit --production || true    # non-zero exit is OK — we just want the output

echo
echo "== 3/4  build =="
npm run build

echo
echo "== 4/4  bundle grep for leaked keys =="
if grep -rE "dop_v1_|AIzaSyAGd1GZWyO30O9PphBvyq0mYzgUsM6QtFI" dist/ ; then
  echo "!! Leaked API keys found in dist/ — investigate above matches." >&2
  exit 1
fi
echo "OK — no leaked keys in dist/"

echo
echo "== All verifications passed =="
