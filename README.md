# cairn

> Automatic worklog and rollup tool that aggregates GitHub, local Git, and Notion activity into Notion pages.

cairn collects a single developer's daily activity — GitHub PRs and reviews, local Git commits across multiple repositories, and Notion edits — and publishes a Korean-language summary to a Notion page each evening. Weekly and monthly rollups are produced automatically.

The tool runs locally on macOS via `launchd` and uses the Claude Agent SDK (no direct Anthropic API calls). Source code is never sent to external services.

## Status

v0.9.0 — all 8 stages complete (CLI + launchd + daily / weekly / monthly + setup guide). 1.0.0 is deferred until robustness work (multi-account GitHub, sleep-aware backfill) lands. Current state: [docs/progress/](docs/progress/).

## Requirements

- macOS (launchd)
- Node 24 LTS (see [.nvmrc](.nvmrc))
- pnpm 10+
- Claude Pro/Max subscription (for Agent SDK quota)
- GitHub fine-grained PAT (read-only)
- Notion internal integration token

## Setup

Full step-by-step guide: [docs/SETUP.md](docs/SETUP.md) ([한국어](docs/SETUP.ko.md)).

Quick start:

```bash
git clone <repo-url> cairn
cd cairn
nvm use
pnpm install

cp .env.example .env
# fill in tokens in .env, then create worklog.config.json (see docs/SETUP.md)
# — or just run the desktop app: the first-run setup writes both for you

pnpm build
node packages/core/dist/main.js --mode=daily --date=$(date +%F) --dry-run
ops/install.sh   # register daily + weekly + monthly launchd jobs
```

## Commands

| Script | Description |
|--------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint with autofix |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check |
| `pnpm build` | Build all packages (`@cairn/core` → `packages/core/dist/`) |
| `pnpm start` | Run `packages/core/dist/main.js` |

## Usage

```bash
node packages/core/dist/main.js --mode=daily --date=$(date +%F) --dry-run
```

Modes: `daily`, `weekly`, `monthly`. Sources can be limited with repeated `--source=` flags (`github`, `local-git`, `notion`).

## Documentation

| Path | Contents |
|------|----------|
| [docs/SETUP.md](docs/SETUP.md) ([한국어](docs/SETUP.ko.md)) | Step-by-step setup guide |
| [docs/plans/](docs/plans/) | Living design plans |
| [docs/progress/](docs/progress/) | Work log entries and stage progress |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |
| [CLAUDE.md](CLAUDE.md) | Working context for Claude Code |
| [AGENTS.md](AGENTS.md) | Working context for Codex |
| [packages/core/AGENTS.md](packages/core/AGENTS.md) | Codex context for core CLI |
| [packages/desktop/AGENTS.md](packages/desktop/AGENTS.md) | Codex context for desktop app |
| [.claude/rules/](.claude/rules/) | Project rules |

## License

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Donghyeok Lim.

Source code is public for reference and forks. Any derivative work — including
modifications and any service that exposes this software over a network — must
also be licensed under AGPL-3.0-or-later and provide its full source to users.
