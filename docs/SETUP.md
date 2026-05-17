# Setup Guide

Step-by-step instructions to install and run cairn on a new macOS machine. cairn is a personal-use worklog tool — every machine you run it on uses its own secrets and configuration.

> **한국어 가이드**: [SETUP.ko.md](SETUP.ko.md)

## 1. Prerequisites

- **macOS** (launchd is required for the daily/weekly/monthly schedule)
- **Node 24 LTS** — see [.nvmrc](../.nvmrc). Install via `nvm`, `volta`, or `homebrew`.
- **pnpm 10+** — `npm install -g pnpm`
- **Claude Pro or Max subscription** — cairn calls the Claude Agent SDK and inherits your Claude Code OAuth credentials. No separate Anthropic API key is required when you are signed in to Claude Code locally.
- **Notion account** with at least one workspace where you can create an internal integration.
- **GitHub account** with PRs / reviews you want to track.

## 2. Clone and install

```bash
git clone https://github.com/<owner>/cairn.git
cd cairn
nvm use            # respects .nvmrc
pnpm install
pnpm build
```

`pnpm build` produces `dist/main.js`, the entry point used by both the CLI and the launchd jobs.

## 3. Notion integration

cairn writes to one Notion workspace at a time per integration. The same parent page hosts both the daily worklog DB and the rollup DB (auto-created on first run).

### 3.1 Create an internal integration

1. Open <https://www.notion.so/profile/integrations> and click **New integration**.
2. Give it a name (e.g. `cairn-personal`) and pick the workspace you will publish into.
3. Capabilities: enable **Read content**, **Update content**, **Insert content**.
4. Save and copy the **Internal Integration Secret** (starts with `ntn_…`).

### 3.2 Create a parent page

1. In the same workspace, create a regular page that will host cairn's databases (e.g. `cairn` or `Worklog`).
2. Open the page menu → **Connections** → **Add connections** → select your integration. The integration must be able to read/write this page.
3. Copy the page URL. The 32-character hex segment at the end is the page ID. Format it as a UUID with dashes (`8-4-4-4-12`). Example:
   ```
   https://notion.so/My-cairn-aabbccddeeff00112233445566778899
   →  pageId = aabbccdd-eeff-0011-2233-445566778899
   ```

### 3.3 Find your Notion user ID

cairn filters Notion edits to entries you authored, using your user ID.

```bash
curl -sS https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer ntn_your_token_here" \
  -H "Notion-Version: 2022-06-28" \
  | jq -r '.id'
```

Copy the UUID — that is your `myUserId`.

## 4. GitHub fine-grained PAT (one per account)

cairn supports multiple GitHub accounts (e.g. personal + work). Create a fine-grained PAT for **each** account you want to track:

1. <https://github.com/settings/personal-access-tokens/new> (while logged into that account)
2. **Resource owner**: yourself (or the org if you want to track org PRs).
3. **Repository access**: pick the specific repos you want to track.
4. **Permissions** (Repository permissions): `Pull requests: Read-only`, `Contents: Read-only`, `Metadata: Read-only`.
5. Generate and copy the token (starts with `github_pat_…`).

cairn never writes to GitHub. Read-only access is sufficient.

Each token goes into a separate `.env` variable (see §6) and is referenced by `githubAccounts[].tokenEnv` in `worklog.config.json` (see §7).

## 5. Local Git repositories

For each local repo whose commits you want included, you need its absolute path. Make sure `git config user.email` matches the email associated with your authoring identity in those repos:

```bash
cd /path/to/repo
git config user.email
```

cairn uses this to filter commits to ones you authored.

## 6. `.env`

Copy the example and fill in the secrets you obtained above:

```bash
cp .env.example .env
```

```env
ANTHROPIC_OAUTH_TOKEN=
# Optional. Leave empty when running under Claude Code (inherits OAuth).

GITHUB_TOKEN_PERSONAL=github_pat_...
GITHUB_TOKEN_WORK=github_pat_...
# Add GITHUB_TOKEN_<LABEL> for each githubAccounts[].tokenEnv you reference.

NOTION_TOKEN_PERSONAL=ntn_...
# Add NOTION_TOKEN_<LABEL> for each notionWorkspaces[].tokenEnv you reference.
```

`.env` is gitignored. Keep it that way.

## 7. `worklog.config.json`

```bash
cp worklog.config.example.json worklog.config.json
```

Fill in:

```json
{
  "localGitRepos": ["/Users/me/code/repo-1", "/Users/me/code/repo-2"],
  "githubAccounts": [
    { "label": "personal", "tokenEnv": "GITHUB_TOKEN_PERSONAL" },
    { "label": "work", "tokenEnv": "GITHUB_TOKEN_WORK" }
  ],
  "notionWorkspaces": [
    {
      "label": "personal",
      "tokenEnv": "NOTION_TOKEN_PERSONAL",
      "myUserId": "<your-notion-user-id>",
      "worklog": { "pageId": "<parent-page-id>" }
    }
  ]
}
```

`githubAccounts` is a free-form array — add as many entries as you have GitHub identities. The `label` is a human-readable name you choose (`personal`, `work`, `oss`, `side-project-a`, …); cairn echoes it back in every PR summary and surfaces it in the Korean digest, so pick something short and unambiguous. `tokenEnv` is the `.env` variable name that holds the PAT — convention is `GITHUB_TOKEN_<UPPER_LABEL>`, but any name works as long as `.env` and this file agree. Omit the array (or leave it empty) only if you want to track zero GitHub accounts.

You only need `worklog.pageId` (the parent page from §3.2). cairn auto-creates two inline databases inside that page on first run:

- `Daily Worklog (cairn)` — daily worklog DB
- `Rollup (cairn)` — weekly/monthly rollup DB (created on first weekly/monthly run)

The discovered `databaseId` and `dataSourceId` for each are written back into `worklog.config.json` automatically. If you want the rollup DB on a different page, set a separate `rollup.pageId` explicitly — otherwise it defaults to the same parent as the worklog DB.

`worklog.config.json` is gitignored.

## 8. First run

### 8.1 Dry-run (no Notion writes)

```bash
node dist/main.js --mode=daily --date=$(date +%F) --dry-run
```

You should see GitHub / local-git / Notion activity dumped as JSON.

### 8.2 Real daily publish

```bash
node dist/main.js --mode=daily --date=$(date +%F)
```

Expected on a successful first run:

- A new inline DB `Daily Worklog (cairn)` appears on your parent page.
- A new page `<date> 작업 일지` is published in that DB.
- `worklog.config.json` gains `databaseId` / `dataSourceId` under `worklog`.
- A macOS notification appears: `cairn 일지 — <date> 발행 (gh:N / git:N / notion:N)`.

### 8.3 Idempotency

Re-running on the same date should print `worklog page already exists — skip (use --force to recreate)` and emit a `skip` notification. Use `--force` to archive and recreate.

### 8.4 First weekly / monthly rollup

Once a daily page exists in a given week / month, you can produce the rollup:

```bash
node dist/main.js --mode=weekly --date=$(date +%F)
node dist/main.js --mode=monthly --date=$(date +%F)
```

The rollup DB is auto-created on the first such run. Weekly title format: `2026-W19 주간 정리`. Monthly: `2026-05 월간 정리`.

## 9. Schedule with launchd

Register all three jobs (daily, weekly, monthly) in one shot:

```bash
ops/install.sh
```

The script:

- Reads each `ops/com.user.cairn-{daily,weekly,monthly}.plist.template`
- Substitutes your absolute Node path, `cairn` directory, and `$HOME`
- Writes the resolved plists to `~/Library/LaunchAgents/`
- Loads them via `launchctl bootstrap gui/$UID`

Verify:

```bash
launchctl list | grep cairn
```

Default schedule (system TZ):

| Job | Schedule |
|-----|----------|
| daily | every day, 19:00 + 23:00 |
| weekly | every Monday, 07:00 + 11:00 |
| monthly | every 2nd of the month, 07:00 + 11:00 |

Each job has two slots so a sleeping laptop catches up at the second wake-up; idempotency prevents duplicate publishes.

### Uninstall

```bash
ops/install.sh --uninstall
```

## 10. Logs and notifications

- Per-run pino logs: `~/.cairn/logs/cairn-YYYY-MM-DD.log` (rotated daily by `pino-roll`).
- launchd stdout / stderr: `~/.cairn/logs/launchd.{out,err}.log`, `launchd-weekly.{out,err}.log`, `launchd-monthly.{out,err}.log`.
- macOS native notifications fire only when `NODE_ENV=production` (set by the launchd plists). Manual CLI runs are silent so dev iteration doesn't spam your notification center.

## 11. Multi-machine setup

cairn is designed to run on multiple personal machines (e.g. work laptop + home laptop). For each new machine:

1. Repeat §2 (clone, install, build).
2. Repeat §6 (`.env`) — never sync `.env` across machines.
3. Repeat §7 (`worklog.config.json`) — only the local-repo absolute paths differ; Notion / GitHub identifiers are shared.
4. Repeat §9 (`ops/install.sh`).

Each machine writes to the same Notion workspace, and idempotency prevents conflicts on the same date.

## 12. Troubleshooting

### The rollup / worklog DB is not created in Notion

The DB is created lazily on the first publish, not at config load. If `--mode=weekly` reports `no daily pages in range — skipping summarizer + publisher`, no publish happens, so no DB. Run with a date range that contains at least one published daily.

### `no notionWorkspace with worklog.pageId`

Either `worklog.pageId` is not set in `worklog.config.json` or the corresponding `tokenEnv` (e.g. `NOTION_TOKEN_PERSONAL`) is empty in `.env`.

### Notion API 401 / 404 on first run

Check that the integration is shared with the parent page (§3.2 step 2). The integration cannot see pages it has not been added to.

### macOS notification does not appear

- The notification only fires under `NODE_ENV=production`. Manual runs from a terminal are silent by design.
- For launchd-triggered runs: System Settings → Notifications → Script Editor → ensure alerts are allowed (osascript notifications use Script Editor's notification permission).

### launchd does not fire

- Use absolute time in plists (already the default). Sleeping laptops do not "catch up" missed slots — that is why daily / weekly / monthly each have two time slots.
- Force a manual fire to verify: `launchctl kickstart -k gui/$UID/com.user.cairn-daily`.
- Check logs: `tail -f ~/.cairn/logs/launchd.err.log`.
- If the laptop is closed for both slots in a day, that day's daily is missed entirely. Two paths to harden this are planned for upcoming releases:
  - **Stage 10 — sleep-aware backfill** (planned): `RunAtLoad: true` on the plists plus a backfill pass that publishes any missed days the next time the laptop opens. No `sudo` needed.
  - **Stage 10 — `pmset` wake (opt-in)** (planned): `ops/install.sh --with-wake` will register `pmset repeat wakeorpoweron` so the Mac wakes briefly at the scheduled time, fires cairn, and goes back to sleep. Requires `sudo` and pairs with `--uninstall` to clean up.
- Until those land, the workaround is manual: `node dist/main.js --mode=daily --date=<missed-date>`.

### Cost tracking callout shows `$0.00` or is missing

The cost callout only renders when the runner is the operator (`CAIRN_OPERATOR_SECRET` env matches the hash baked into source). External users / forks see no cost callout — this is intentional ([ADR 0009](decisions/0009-summarizer-auth-and-sanitize.md)).
