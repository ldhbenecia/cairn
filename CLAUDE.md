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

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project context (cairn)

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

회사 백엔드 개발자(NestJS) 본인용 자동 작업 일지. GitHub PR/리뷰 + 로컬 Git 커밋 + Notion 편집 활동을 모아 Claude Agent SDK 로 한국어 요약 → Notion 일지 페이지 발행. 주간/월간 롤업도 자동.

### 살아있는 plan

[docs/plans/2026-04-26-cairn-overall.md](docs/plans/2026-04-26-cairn-overall.md). 새 plan 은 `docs/plans/YYYY-MM-DD-<slug>.md` 로 누적.

### 룰 인덱스

| 파일 | 내용 |
|------|------|
| [.claude/rules/work-start-checklist.md](.claude/rules/work-start-checklist.md) | 작업 시작 시 컨텍스트 잡는 순서 |
| [.claude/rules/nestjs-conventions.md](.claude/rules/nestjs-conventions.md) | 파일·클래스·디렉토리 명명, 공식 docs 우선 |
| [.claude/rules/security-egress.md](.claude/rules/security-egress.md) | 외부 송신 금지·화이트리스트·redaction |
| [.claude/rules/git-conventions.md](.claude/rules/git-conventions.md) | 브랜치·커밋·PR 컨벤션 |
| [.claude/rules/decisions-workflow.md](.claude/rules/decisions-workflow.md) | ADR 작성 흐름 |
| [.claude/rules/progress-update.md](.claude/rules/progress-update.md) | 작업 일지 작성 규칙 |

### 핵심 ADR

| ADR | 결정 |
|-----|------|
| [0001](docs/decisions/0001-use-claude-agent-sdk.md) | Claude Agent SDK 사용 (Anthropic API 직접 호출 X) |
| [0002](docs/decisions/0002-portable-deploy.md) | 머신별 시크릿 분리, 클라우드 X |
| [0003](docs/decisions/0003-no-code-body-egress.md) | 코드 본문·diff 외부 송신 금지 |
| [0004](docs/decisions/0004-nestjs-conventions.md) | NestJS 공식 컨벤션 준수 |
| [0005](docs/decisions/0005-versioning-policy.md) | SemVer + PR 단위 bump |
| [0006](docs/decisions/0006-github-flow-not-git-flow.md) | GitHub Flow (main 단일 트렁크) |
| [0007](docs/decisions/0007-merge-commit-strategy.md) | merge commit 정책 |

### 진행 상황

[docs/progress/README.md](docs/progress/README.md) — 단계별 진행률 표 + 일지 디렉토리.
