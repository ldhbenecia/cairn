# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Verify Before Claiming

**Never report success or "no bugs" without evidence. Run the check.**

- Before saying "done": run the relevant build / typecheck / tests and state the result. If you couldn't run it, say so explicitly.
- "I found no bugs" requires an actual audit — read the code paths, trace concrete failure scenarios. A glance is not an audit. When asked to find bugs, assume there ARE some until you've genuinely looked, and report *what you checked* and *how* (file:line, scenario), not just a verdict.
- Report outcomes faithfully: if tests fail, show the output; if a step was skipped, say it. No silent success, no hedging when it actually passed.
- For outward-facing / costly / irreversible actions (publishing to Notion, sending, deleting, large backfills that spend Claude tokens), confirm scope first and don't claim it happened until verified from the actual result.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation, and claims of "done/passing/no-bugs" are always backed by a run.

---

## cairn — project non-negotiables

This repo has detailed rules in `.claude/rules/` (full index + ADRs + live plans in cairn-context below). **Read the relevant rule before touching its area.** The ones that bite hardest if ignored:

- **Start by reading context** — [.claude/rules/work-start-checklist.md](.claude/rules/work-start-checklist.md): current stage ([docs/progress/README.md](docs/progress/README.md)), relevant ADRs ([docs/decisions/](docs/decisions/)), the live plan ([docs/plans/](docs/plans/)). Don't code before you know where things stand.
- **Egress security is a hard wall** — [.claude/rules/security-egress.md](.claude/rules/security-egress.md) + ADR 0003/0021: NEVER send code bodies, diffs/patches/hunks, absolute paths, tokens, emails, or per-user identifiers to any external sink (Claude/Notion/GitHub). Whitelist only. Apply the fail-closed `assertNoForbiddenPayload` on EVERY external payload — including debug/operator dumps, not just the obvious ones.
- **Local timezone, never KST** — [.claude/rules/timezone.md](.claude/rules/timezone.md): use local `Date` methods; no `setUTCHours`, no hardcoded `+9`. For any date logic, first ask "does this assume KST?". The user runs cairn from anywhere.
- **Process discipline** — [.claude/rules/git-conventions.md](.claude/rules/git-conventions.md) + [.claude/rules/progress-update.md](.claude/rules/progress-update.md): PR body uses the template (요약/작업사항/체크리스트); version bump is patch by default, **one minor per perceivable feature bundle, not per PR** (ADR 0020); commit in logical incremental units (no "+"-bundled mega-commits); write thorough progress docs and an ADR for non-trivial decisions.
- **NestJS conventions** — [.claude/rules/nestjs-conventions.md](.claude/rules/nestjs-conventions.md): no barrel `index.ts`, always concrete-path imports, official NestJS docs first.
- **Minimal comments** — only genuinely-needed ones (eslint-disable, egress/timezone gotchas, non-obvious why). No metadata/narration comments in output files.

> Internal docs (`docs/decisions/`, `docs/plans/`, `docs/progress/`, `.claude/cairn-context.md`) are **local-only (gitignored)** — present on the maintainer's machine, not in the public repo. The links above resolve locally.

@.claude/cairn-context.md
