# CLAUDE.md

## cairn — 프로젝트 규칙

세부 규칙은 `.claude/rules/`. 해당 영역을 건드리기 전에 그 문서를 읽는다.

- 작업 시작 전 컨텍스트: [docs/progress/README.md](docs/progress/README.md) 진행률 표 + 최근 일지 1~2개, 관련 ADR([docs/decisions/](docs/decisions/)), 진행 중 plan([docs/plans/](docs/plans/))
- egress 보안 — [security-egress.md](.claude/rules/security-egress.md)
- 로컬 타임존 — [timezone.md](.claude/rules/timezone.md)
- 커밋·PR·버전 — [git-conventions.md](.claude/rules/git-conventions.md), 일지 — [progress-update.md](.claude/rules/progress-update.md), ADR — [decisions-workflow.md](.claude/rules/decisions-workflow.md)
- NestJS — [nestjs-conventions.md](.claude/rules/nestjs-conventions.md)
- 주석 — [code-comments.md](.claude/rules/code-comments.md)

> `docs/decisions/`, `docs/plans/`, `docs/progress/` 는 로컬 전용(gitignore). 메인테이너 머신에만 있고 공개 레포에는 없음
