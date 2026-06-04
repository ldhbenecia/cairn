# cairn

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

cairn turns your daily dev activity — GitHub PRs/reviews and local Git commits across multiple repos — into a Claude-summarized worklog published to Notion, with automatic weekly and monthly rollups.

It runs as an **Electron desktop app** on top of a headless engine. Everything stays on your machine: it uses the Claude Agent SDK (no direct Anthropic API calls) and never sends source code or diffs to external services.

## Highlights

- **Aggregate** — GitHub PRs/reviews + local Git commits across multiple repositories
- **Summarize** — Claude (Agent SDK) writes a Korean-language worklog
- **Publish** — to Notion: daily logs + automatic weekly/monthly rollups
- **Desktop app** — guided first-run setup, one-click publish, opt-in auto-publish at a time you choose (your local timezone), in-app Notion viewer, dark/light/system themes, ko/en
- **Local-first & private** — machine-local secrets, no server, no code-body egress (ADR 0003)

## Requirements

- macOS
- Claude Pro/Max subscription or Anthropic API key (for the Agent SDK)
- GitHub fine-grained PAT (read-only)
- Notion internal integration token

The desktop app's first-run setup walks you through connecting these and writes the config for you.

## Build & run from source

Packaged releases are planned; for now build from source.

- Node 24 LTS (see [.nvmrc](.nvmrc)), pnpm 10+

```bash
git clone https://github.com/ldhbenecia/cairn.git
cd cairn
nvm use
pnpm install

pnpm --filter @cairn/desktop dev   # run the desktop app (dev)
```

Headless engine only (CLI):

```bash
pnpm build
node packages/core/dist/main.js --mode=daily --date=$(date +%F) --dry-run
```

Modes: `daily`, `weekly`, `monthly`. Manual setup of `.env` + `worklog.config.json` is documented in [docs/SETUP.md](docs/SETUP.md) ([한국어](docs/SETUP.ko.md)) — though the desktop app generates both.

> The `launchd` jobs under [ops/](ops/) are **deprecated** — auto-publish is owned by the desktop app (ADR 0015). They remain only for headless/CLI-only setups.

## Architecture

pnpm monorepo:

- `packages/core` — headless engine (collectors → Claude summarizer → Notion publisher), runnable as a CLI
- `packages/desktop` — Electron app (setup wizard, manual/auto publishing, in-app log viewer, preferences)

## Documentation

| Path | Contents |
|------|----------|
| [docs/SETUP.md](docs/SETUP.md) ([한국어](docs/SETUP.ko.md)) | Manual setup guide |
| [docs/plans/](docs/plans/) | Living design plans |
| [docs/progress/](docs/progress/) | Work log entries and stage progress |
| [docs/decisions/](docs/decisions/) | Architecture Decision Records |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Working context for Claude Code / Codex |
| [.claude/rules/](.claude/rules/) | Project rules |

## Privacy

Your worklogs, code, and tokens stay on your machine. They are only sent to the services you configure (Notion, GitHub, Claude) — never anywhere else.

cairn sends **anonymous usage telemetry** (PostHog) to understand how many people use it and which versions are active. It is enabled by default and can be turned off in **Preferences → About → Anonymous usage stats**.

- **Sent**: a random anonymous install id, app version, OS/arch, and event names (`app_launched`, `publish` with mode + outcome).
- **Never sent**: worklog content, PR titles, repo names, commit messages, file paths, tokens, or any personal information.

See [docs/decisions/0017-anonymous-telemetry.md](docs/decisions/0017-anonymous-telemetry.md).

## License

[AGPL-3.0-or-later](LICENSE). Copyright (C) 2026 Donghyeok Lim.

Source code is public for reference and forks. Any derivative work — including
modifications and any service that exposes this software over a network — must
also be licensed under AGPL-3.0-or-later and provide its full source to users.
