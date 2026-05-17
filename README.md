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
cp worklog.config.example.json worklog.config.json
# fill in tokens in .env and absolute repo paths in worklog.config.json

pnpm build
node dist/main.js --mode=daily --date=$(date +%F) --dry-run
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
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run `dist/main.js` |

## Usage

```bash
node dist/main.js --mode=daily --date=$(date +%F) --dry-run
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
| [.claude/rules/](.claude/rules/) | Project rules |

## License

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Donghyeok Lim.

Source code is public for reference and forks. Any derivative work — including
modifications and any service that exposes this software over a network — must
also be licensed under AGPL-3.0-or-later and provide its full source to users.
