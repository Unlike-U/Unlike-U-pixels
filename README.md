# pixelpunisher.x

**Turn a bitmap into GitHub contributions.** Your contribution graph is a 53 × 7
grid of 371 pixels with five intensities — and an intensity is just a commit
count. pixelpunisher.x designs that bitmap, connects your GitHub account with
OAuth, and lets an interval painter commit it onto your profile, tick by tick.

```
level 0 → 0 commits   level 2 → 2 commits   level 4 → 4 commits
```

The logo is a 16×16 pixel skull; a simplified 7×7 version ships in the studio
pattern library and tiles across a real contribution graph.

---

## Two editions, one codebase

| | Next.js edition (repo root) | Vite edition (`vite-app/`) |
|---|---|---|
| Hosting | any Node host | **Vercel** (static SPA + Functions) |
| Scheduler | server-side, Postgres-backed — paints while you sleep | in-browser — keep the tab open |
| Tokens | AES-256-GCM encrypted at rest | browser local storage |
| OAuth | web flow + device flow + PAT | web flow (via `/api/oauth-exchange`) + device flow + PAT |
| Database | PostgreSQL via Drizzle | none |

The bitmap engine (`src/lib/grid.ts`), pixel grid, icons and GitHub transport
are shared between both editions.

## Deploy the Vite edition to Vercel

```bash
./deploy.sh            # production
./deploy.sh preview    # preview deployment
```

The script installs, builds `vite-app/`, and runs `vercel deploy --prod`.
First run will ask you to log in and link a project.

**Manual equivalent:**

```bash
cd vite-app
npm run sync:shared   # vendor ../src → vite-app/src/shared
npm install
npm run build
npx vercel --prod
```

### Why `sync:shared` exists

The bitmap engine, pixel grid, icons, logo and GitHub transport are shared with
the Next.js edition. Vercel only uploads the **linked project directory**
(`vite-app`), so a build that imports `../src` fails remotely with
`Command "npm run build" exited with 1` even though it works locally.

`sync-shared.mjs` therefore copies the ten browser-safe modules into
`vite-app/src/shared` (committed to the repo) and refuses to copy anything that
touches `process.env`, `drizzle-orm`, `@/db`, `node:crypto` or `next/`.
`deploy.sh` runs it before every build; if `../src` is absent (i.e. on Vercel)
it no-ops and uses the committed copy.

To enable the **Authorize with GitHub** button, set two env vars in the Vercel
project (Settings → Environment Variables) and register them on a GitHub OAuth
App whose callback URL is your site origin:

| Variable | Where |
|---|---|
| `GITHUB_CLIENT_ID` | Vercel env (exposed to the SPA via `/api/oauth-config` — client IDs are public) |
| `GITHUB_CLIENT_SECRET` | Vercel env (server-only, used by `/api/oauth-exchange`) |

Without them, the studio falls back to the **device flow** (needs only a
Client ID) or a pasted **personal access token**.

## Run locally

```bash
# Vite edition
cd vite-app && npm install && npm run dev        # http://localhost:5173

# Next.js edition (needs DATABASE_URL)
npm install && npx drizzle-kit push && npm run dev
```

## How it works

1. **Draw** — paint by hand, typeset with the built-in 5×7 pixel font, import
   an image (quantised to 53×7), or sample a real GitHub calendar.
2. **Connect** — OAuth authorization-code flow; the token exchange happens
   server-side. Scopes: `repo read:user user:email` (the verified email is
   what makes commits count).
3. **Arm** — choose a cadence (30 s … 24 h), cells per tick, paint order and
   commit multiplier. Each tick converts pixels into backdated commits through
   the Git Data API and moves the branch ref once.
4. **Verify** — the real contribution calendar is read back over GraphQL and
   diffed against your design, cell by cell.

Full documentation lives in the app at `/guide` (Next.js) or `#/guide` (Vite).

## Layout

```
src/            Next.js edition (App Router, API routes, Drizzle schema)
  lib/grid.ts   the shared bitmap engine — presets, pixel font, paint orders
  lib/github.ts the shared GitHub transport (REST + Git Data API + GraphQL)
vite-app/       Vite edition (SPA + Vercel Functions in vite-app/api/)
deploy.sh       one-command Vercel deploy for the Vite edition
```

---

© pixelpunisher.x · designed with ❤ by **unlike.u**
