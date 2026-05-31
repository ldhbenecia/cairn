# AGENTS.md

Instructions for `packages/core`.

## Scope

This package owns the local CLI, collectors, summarizer harness, Notion
publisher, rollups, configuration loading, logging, and launchd-facing behavior.

## Architecture

- Follow NestJS service/provider patterns.
- The core app is standalone. Use `NestFactory.createApplicationContext`; do not
  add HTTP controllers or HTTP modules unless a new ADR changes the product
  direction.
- Keep external-system adapters focused by source: GitHub, local Git, Notion,
  summarizer, publisher, state, and config.
- Prefer constructor injection and explicit `@Injectable()`.
- Put shared contracts in `src/contracts/` or module-local `*.interface.ts`
  files.

## Naming And Imports

- Files use kebab-case plus type suffix:
  - `users.service.ts`
  - `create-user.dto.ts`
  - `user-repository.interface.ts`
- Classes use PascalCase plus type suffix:
  - `UsersService`
  - `CreateUserDto`
  - `GithubCollectorService`
- Resource/domain directories use plural names. External-system adapters can be
  singular, for example `github/`, `notion/`, or `summarizer/`.
- Do not add barrel `index.ts` re-exports.
- Import concrete files directly and preserve the repo's ESM import style.

## Security And Egress

- Preserve ADR 0003: never send source code bodies, diffs, patches, hunks,
  absolute paths, tokens, emails, or user-specific identifiers to external APIs.
- Allowed outbound activity metadata is narrow: PR title/short description,
  labels, merge state, changed file names only, commit title line, short SHA,
  Notion page metadata, and repo basename.
- Do not add `diff`, `patch`, source body, hunk, or absolute path fields to
  outbound DTOs.
- Exclude sensitive fields at the type boundary instead of filtering them late.
- Keep redaction helpers and tests for secrets and diff-like content.

## Verification

Use the narrowest useful command for the change:

```bash
pnpm --filter @cairn/core typecheck
pnpm --filter @cairn/core test
pnpm build
```
