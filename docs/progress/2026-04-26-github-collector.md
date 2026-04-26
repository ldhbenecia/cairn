# 2026-04-26 — github collector

> 진행 단계: **1 — NestJS 스켈레톤 + GitHub 수집** ✅ (2026-04-26 완료)
> 상태: 완료

## 완료

- `src/contracts/github-activity.types.ts` — `GithubActivity` / `GithubPrSummary` / `GithubActivityCategory` 화이트리스트 타입 (diff/패치/파일 경로/이메일 정의 자체 X — ADR 0003)
- `src/github/date-window.ts` — KST 일자 → UTC ISO 윈도우 (`2026-04-26` → `2026-04-25T15:00:00Z..2026-04-26T14:59:59Z`) + `searchRangeFragment` 헬퍼
- `src/github/github-api.client.ts` — `searchPrs(query)` / `listPrFileBasenames(owner, repo, n)` 메서드 추가. 응답을 `SearchPrItem`(우리 타입) + 파일명 basename 배열로 좁힘
- `src/github/github-collector.service.ts` — 4 search queries 병렬 실행 → `Map` 으로 dedupe + 카테고리 aggregate → 각 PR 의 `listPrFileBasenames` 병렬 fetch → `GithubActivity` 투영
- `GithubModule` 에 `GithubCollectorService` 추가 + export
- `CairnModule` 이 `GithubModule` import (Orchestrator 에 collector 주입 위해)
- `OrchestratorService.run()` async 화 + 모드 분기. daily 일 때 `--source` 가 `'all'` 이거나 `github` 포함이면 collector 호출. dry-run 이면 `process.stdout.write` 로 JSON dump
- typecheck / lint / build / dry-run 부팅 검증 (`--source=notion` 으로 GitHub 스킵, `--source=github` 으로 lazy auth throw 동작 확인)
- 진행률 표 단계 1 ✅ 2026-04-26
- minor bump `0.1.5 → 0.2.0`

## 시행착오 / 결정

- **`repo` 필드 = `name` 만** (owner/org 제외) — 화이트리스트 원칙. owner 가 필요한 부분(octokit 호출)은 `SearchPrItem` 같은 내부 타입에만 두고, 외부 노출 타입 `GithubPrSummary` 에서는 `repo: string` (basename) 으로 좁힘. htmlUrl 이 owner 정보 가지고 있어 사용자 navigate 는 충분.
- **파일 경로 = basename 만** — security-egress 룰 "이름만 (경로 X)". `src/foo/bar.ts` → `bar.ts`. 경로 정보 손실 있지만 룰 준수.
- **PR dedup**: 4개 query 결과가 겹치므로 `Map<owner/repo#number>` 로 dedupe + `categories: Set` 으로 출처 추적. authored 와 authored_merged 가 동일 PR 에 둘 다 붙는 경우 정상.
- **`pulls.listFiles` 호출 위치**: dedup 이후 한 번만. 4 query 결과가 겹쳐도 PR 1개당 listFiles 1회.
- **Daily 외 모드 (weekly/monthly)** 는 collector 호출 X — 단계 7 rollup 에서 일지 DB 조회로 처리.
- **DI 함정**: `OrchestratorService` 가 `GithubCollectorService` 를 주입받으려면 `CairnModule` 이 `GithubModule` 을 import 해야 함. 처음에 빠뜨려서 `UnknownDependenciesException` → CairnModule.imports 추가로 해결.
- **테스트 / 단위 redaction 검증**: 정식 단위 테스트 도입은 단계 5 (summarizer) 시점. 이 PR 에서는 dry-run JSON 을 사람이 검토하는 수준.

## 다음

- 단계 2 — 로컬 Git 수집 (`feature/local-git-collector`). `simple-git` 또는 child_process 로 `git log --since/--until --author --no-merges`. pushed/unpushed 분류 (`git branch -r --contains`).
