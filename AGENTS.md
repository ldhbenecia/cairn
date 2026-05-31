# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with
project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks,
use judgment.

## 1. Think Before Coding

Do not assume. Do not hide confusion. Surface tradeoffs.

Before implementing:

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them instead of picking silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what is confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No flexibility or configurability that was not requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

Ask: would a senior engineer say this is overcomplicated? If yes, simplify.

## 3. Surgical Changes

Touch only what is necessary. Clean up only your own changes.

When editing existing code:

- Do not improve adjacent code, comments, or formatting.
- Do not refactor things that are not broken.
- Match existing style, even if another style seems preferable.
- If unrelated dead code is noticed, mention it instead of deleting it.

When changes create orphans:

- Remove imports, variables, and functions that this change made unused.
- Do not remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" -> write tests for invalid inputs, then make them pass.
- "Fix the bug" -> write a test that reproduces it, then make it pass.
- "Refactor X" -> ensure tests pass before and after.

For multi-step tasks, state a brief plan:

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

Strong success criteria allow independent progress. Weak criteria, such as
"make it work", require clarification.

## Project Rules

Codex loads `AGENTS.md` files from the repository root down to the current
working directory. Keep broad repository rules here and package-specific rules
in package-local `AGENTS.md` files.

Codex `.rules` files are for command approval policy, not natural-language
project instructions. Do not create `.codex/rules/*.md` for coding conventions;
use nested `AGENTS.md` files instead.

Package instructions:

- `packages/core/AGENTS.md` - core CLI, NestJS, collectors, summarizer, Notion
  publishing
- `packages/desktop/AGENTS.md` - Electron desktop app, React renderer, desktop
  UX conventions

Project context:

- cairn is a local macOS worklog tool for one backend developer.
- It collects GitHub PR/review activity, local Git commits, and Notion edit
  activity, then publishes Korean daily/weekly/monthly summaries to Notion.
- Runtime baseline: Node 24 LTS and pnpm 10+.
- The core CLI must not send source code bodies, diffs, patches, hunks, absolute
  paths, tokens, emails, or other sensitive identifiers to external APIs.

Before starting non-trivial work:

1. Check `docs/progress/README.md` for current stage/status.
2. Skim the most recent relevant entry in `docs/progress/`.
3. Read related ADRs in `docs/decisions/` when the topic overlaps.
4. Check `docs/plans/` when the task touches planned product direction.
5. Follow package-local `AGENTS.md` instructions when working under a package.

Docs and workflow:

- Work logs live in `docs/progress/YYYY-MM-DD-<slug>.md` using KST dates.
- Add an ADR in `docs/decisions/` for non-obvious, long-lived decisions.
- Branch from `main` using `feature/<slug>`, `fix/<slug>`,
  `refactor/<slug>`, `docs/<slug>`, or `chore/<slug>`.
- Use Conventional Commits. Prefer Korean noun-phrase subjects when natural.
- Keep user-specific Codex config, auth, model, and approval settings out of the
  repository.
