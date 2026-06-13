# @cairn/web

The cairn marketing landing site. **Independent of the desktop app** — it has no version/tag/release of its own and is deployed by Vercel on every `main` push.

## Stack

- Next.js (App Router) + React + Tailwind v4
- GitHub star count and the latest release are fetched in a server component with 1-hour ISR (`lib/github.ts`)

## Local

```bash
pnpm --filter @cairn/web dev     # http://localhost:3000
pnpm --filter @cairn/web build   # production build
```

## Deploy on Vercel (one-time setup)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the cairn repo
2. Set **Root Directory** to `packages/web` (Framework: Next.js is auto-detected)
3. Install runs from the monorepo root (`pnpm install`); build is `next build`
4. Deploy. Subsequent pushes to `main` that touch the site redeploy automatically.

> No tokens/secrets needed (public GitHub API only). Add a custom domain in the Vercel dashboard.

## Separation from the app

- Excluded from the root `eslint.config.mjs` (uses Next's own lint)
- Has no `typecheck` script, so it's skipped by the root `pnpm -r typecheck`
- Not subject to version bumps, git tags, or the release workflow
