# Project context (cairn)

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

회사 백엔드 개발자(NestJS) 본인용 자동 작업 일지. GitHub PR/리뷰 + 로컬 Git 커밋 + Notion 편집 활동을 모아 Claude Agent SDK 로 한국어 요약 → Notion 일지 페이지 발행. 주간/월간 롤업도 자동.

## 살아있는 plan

[docs/plans/2026-04-26-cairn-overall.md](../docs/plans/2026-04-26-cairn-overall.md). 새 plan 은 `docs/plans/YYYY-MM-DD-<slug>.md` 로 누적.

## 룰 인덱스

| 파일 | 내용 |
|------|------|
| [rules/work-start-checklist.md](rules/work-start-checklist.md) | 작업 시작 시 컨텍스트 잡는 순서 |
| [rules/nestjs-conventions.md](rules/nestjs-conventions.md) | 파일·클래스·디렉토리 명명, 공식 docs 우선 |
| [rules/security-egress.md](rules/security-egress.md) | 외부 송신 금지·화이트리스트·redaction |
| [rules/git-conventions.md](rules/git-conventions.md) | 브랜치·커밋·PR 컨벤션 |
| [rules/decisions-workflow.md](rules/decisions-workflow.md) | ADR 작성 흐름 |
| [rules/progress-update.md](rules/progress-update.md) | 작업 일지 작성 규칙 |
| [rules/timezone.md](rules/timezone.md) | KST 단정 금지·사용자 로컬 타임존 기준 |

## 핵심 ADR

| ADR | 결정 |
|-----|------|
| [0001](../docs/decisions/0001-use-claude-agent-sdk.md) | Claude Agent SDK 사용 (Anthropic API 직접 호출 X) |
| [0002](../docs/decisions/0002-portable-deploy.md) | 머신별 시크릿 분리, 클라우드 X |
| [0003](../docs/decisions/0003-no-code-body-egress.md) | 코드 본문·diff 외부 송신 금지 |
| [0004](../docs/decisions/0004-nestjs-conventions.md) | NestJS 공식 컨벤션 준수 |
| [0005](../docs/decisions/0005-versioning-policy.md) | SemVer + PR 단위 bump |
| [0006](../docs/decisions/0006-github-flow-not-git-flow.md) | GitHub Flow (main 단일 트렁크) |
| [0007](../docs/decisions/0007-merge-commit-strategy.md) | merge commit 정책 |

## 진행 상황

[docs/progress/README.md](../docs/progress/README.md) — 단계별 진행률 표 + 일지 디렉토리.
