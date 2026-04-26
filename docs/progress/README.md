# Progress

> 작업 일지. cairn 자체의 메타 일지로, 매 작업 단위마다 새 파일을 누적한다.
> 파일명: `YYYY-MM-DD-<slug>.md` (KST 기준, slug는 그 작업의 주제 — kebab-case)
>
> 한 날에 여러 작업이 있으면 여러 파일도 OK (예: `2026-04-26-repo-scaffold.md`, `2026-04-26-debug-husky.md`).

## 단계별 진행률

| 단계 | 설명 | 상태 |
|------|------|------|
| 0 | 레포 + 문서 + 품질 도구 셋업 | ✅ 2026-04-26 |
| 1 | NestJS 스켈레톤 + GitHub 수집 | — |
| 2 | 로컬 Git 수집 | — |
| 3 | Notion 수집 | — |
| 4 | Notion publisher (일지) | — |
| 5 | Summarizer agent harness (daily) | — |
| 6 | launchd daily | — |
| 7 | 롤업 (weekly + monthly) | — |
| 8 | 셋업 가이드 + v1.0.0 | — |

## 일지 (시간 역순)

- [2026-04-26 — repo scaffold](2026-04-26-repo-scaffold.md) — 단계 0 시작, 베이스 + 품질 도구 셋업

## 작성 규칙

- 작업 시작 시 새 파일: `YYYY-MM-DD-<slug>.md`
- slug 예: `repo-scaffold`, `github-collector`, `debug-husky`, `agent-harness-design`, `notion-publisher`, `auth-redesign`
- 본문 권장 섹션: **완료**, **진행 중**, **시행착오 / 결정**, **다음**
- 갱신은 별도 commit (`docs(progress): YYYY-MM-DD-<slug>` 또는 `docs(progress): update <slug>`)
- 한 일지 안에서 결정한 것 중 비자명한 것은 **별도 ADR**(`docs/decisions/`)로도 옮김
- 단계 완료 시: 위 진행률 표 갱신 + `package.json` version bump (단계별 minor)
