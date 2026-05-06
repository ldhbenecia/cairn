# cairn

> Automatic worklog and rollup tool that aggregates GitHub, local Git, and Notion activity into Notion pages.

cairn collects a single developer's daily activity — GitHub PRs and reviews, local Git commits across multiple repositories, and Notion edits — and publishes a Korean-language summary to a Notion page each evening. Weekly and monthly rollups are produced automatically.

The tool runs locally on macOS via `launchd` and uses the Claude Agent SDK (no direct Anthropic API calls). Source code is never sent to external services.

## Status

Stage 1 of 8 complete (NestJS skeleton + GitHub collector). Current state: [docs/progress/](docs/progress/).

## Requirements

- macOS (launchd)
- Node 24 LTS (see [.nvmrc](.nvmrc))
- pnpm 10+
- Claude Pro/Max subscription (for Agent SDK quota)
- GitHub fine-grained PAT (read-only)
- Notion internal integration token

## Setup

```bash
git clone <repo-url> cairn
cd cairn
nvm use
pnpm install

cp .env.example .env
cp worklog.config.example.json worklog.config.json
# fill in tokens in .env and absolute repo paths in worklog.config.json

pnpm build
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
| [docs/plans/](docs/plans/) | Living design plans |
| [docs/progress/](docs/progress/) | Work log entries and stage progress |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |
| [CLAUDE.md](CLAUDE.md) | Working context for Claude Code |
| [.claude/rules/](.claude/rules/) | Project rules |

## License

UNLICENSED. Personal tool; public for reference. Fork freely.
