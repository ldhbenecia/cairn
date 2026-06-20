# cairn review style guide (Gemini Code Assist)

> **Language: write every review comment, summary, and PR overview in Korean.** (Quote code/identifiers verbatim.)

Review from the perspective of a senior backend engineer. Focus on substantive issues (bugs, races, compatibility, security, performance) over style nits, and understand the intent of the change first.

## Must check (cairn core rules)

- **No external egress**: never send code bodies, diffs, patches, absolute paths, tokens, emails, or identifiers to external sinks (Claude/Notion/GitHub). Whitelist only (PR title, first line of description, changed file names, commit subject, short SHA). Every external payload runs the fail-closed `assertNoForbiddenPayload`; operator/debug dumps are no exception. (.claude/rules/security-egress.md, ADR 0003/0021)
- **Timezone**: machine-local timezone. No `setUTCHours`, no hardcoded `+9`, no KST assumptions. Use local `Date` methods for date logic. (.claude/rules/timezone.md)
- **Stats source of truth**: local `~/.cairn/worklog-stats.json` (ADR 0027). Do not derive stats from Notion properties.
- **NestJS conventions**: no barrel `index.ts`; import from concrete paths.

## Priorities

- CRITICAL: null dereferences, breaking changes, race conditions, data loss (e.g. create-before-archive ordering), runtime/compile errors
- HIGH: duplicated logic, over-broad function responsibility, side effects, improper concurrency/sequencing
- LOW: naming, documentation, type safety, typos

## Notes

- Do not flag intentional design as a defect — consult the relevant modules/rules (.claude/rules/, docs/decisions/) first.
- Keep comments concise and in Korean.
