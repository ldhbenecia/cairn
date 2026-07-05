# @cairn/web

The cairn marketing landing site **and** the cross-device sync backend. **Independent of the desktop app** — it has no version/tag/release of its own and is deployed to Vercel by GitHub Actions (`.github/workflows/web-deploy.yml`) when `main` pushes touch `packages/web`.

## Stack

- Next.js (App Router) + React + Tailwind v4
- GitHub star count and the latest release are fetched in a server component with 1-hour ISR (`lib/github.ts`)
- Cross-device sync backend: Better Auth (Google OAuth) + Drizzle ORM + PostgreSQL (`lib/auth.ts`, `lib/db.ts`, `app/api`)

## Local

```bash
pnpm --filter @cairn/web dev     # http://localhost:3000
pnpm --filter @cairn/web build   # production build
```

## Deploy on Vercel (one-time setup)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the cairn repo
2. Set **Root Directory** to `packages/web` (Framework: Next.js is auto-detected)
3. Install runs from the monorepo root (`pnpm install`); build is `next build`
4. Add the GitHub Actions secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (repo Settings → Secrets and variables → Actions)
5. Deploys run through `.github/workflows/web-deploy.yml` — `main` pushes touching the site go to production, PRs get a preview deploy. Vercel's own Git auto-deploy is disabled (`vercel.json`).

> The landing site itself needs no secrets (public GitHub API only). The **sync backend** requires env vars set in the Vercel dashboard (and `.env.local` for local dev): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Add the custom domain (`cairnlog.cloud`) in the Vercel dashboard.

## Separation from the app

- Excluded from the root `eslint.config.mjs` (uses Next's own lint)
- Has no `typecheck` script, so it's skipped by the root `pnpm -r typecheck`
- Not subject to version bumps, git tags, or the release workflow
