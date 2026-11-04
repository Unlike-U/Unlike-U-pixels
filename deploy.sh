#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# pixelpunisher.x — deploy the Vite edition to Vercel
#
#   ./deploy.sh            production deploy (vercel --prod)
#   ./deploy.sh preview    preview deploy
#
# First run links the Vercel project (you'll be asked to log in and pick a
# scope). Set these env vars in the Vercel dashboard to enable OAuth:
#   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/vite-app"
MODE="${1:-production}"

cd "$APP"

echo "▸ pixelpunisher.x · deploying the Vite edition from $APP"

# Vendor the shared browser-safe modules from ../src into vite-app/src/shared.
# Vercel only uploads this directory, so the build must not reach outside it.
echo "▸ syncing shared modules from ../src"
node sync-shared.mjs

if [ -f package-lock.json ]; then
  echo "▸ installing dependencies (npm ci)"
  npm ci
else
  echo "▸ installing dependencies (npm install)"
  npm install
fi

echo "▸ typechecking"
npm run typecheck

echo "▸ building"
npm run build

if command -v vercel >/dev/null 2>&1; then
  VERCEL="vercel"
else
  VERCEL="npx --yes vercel@latest"
fi

if [ "$MODE" = "preview" ]; then
  echo "▸ deploying preview to Vercel"
  $VERCEL deploy
else
  echo "▸ deploying production to Vercel"
  $VERCEL deploy --prod
fi

echo ""
echo "✓ done — pixelpunisher.x is live."
echo ""
echo "  To enable the \"Authorize with GitHub\" button, set these in Vercel"
echo "  (Project → Settings → Environment Variables) and redeploy:"
echo "    GITHUB_CLIENT_ID"
echo "    GITHUB_CLIENT_SECRET"
echo ""
echo "  Without them, the studio still works via the device flow (Client ID only)"
echo "  or a pasted personal access token."
