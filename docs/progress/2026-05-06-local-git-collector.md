# 2026-05-06 — local-git collector

> 진행 단계: **2 — 로컬 Git 수집** ✅ (2026-05-06 완료)
> 상태: 완료

## 완료

- `simple-git` 3.36 의존 추가
- `src/contracts/local-git-activity.types.ts` — `LocalGitActivity` / `LocalGitRepoActivity` / `LocalGitCommitSummary` 화이트리스트 타입 (full SHA / 본문 / 절대경로 / author email 정의 자체 X — ADR 0003)
- `src/local-git/local-git.client.ts` — simple-git 래퍼: `checkIsRepo` / `getUserEmail` / `listCommits` / `localBranchesContaining` / `remoteBranchesContaining`. raw `git log --no-merges --since/--until --author --pretty=%h%x09%s%x09%aI` + `git branch [-r] --contains <sha> --format=%(refname:short)`
- `src/local-git/local-git-collector.service.ts` — KST→UTC 윈도우 (`github/date-window.ts` 재사용), `WorklogConfigService` 의 repo 절대경로 목록 순회, `Promise.allSettled` 로 일부 실패 격리. `pickBranch` 가 트렁크/통합 브랜치(`main`/`master`/`develop`/`release` + `release/` prefix)는 후순위, 작업 브랜치 우선 노출
- `LocalGitModule` + `AppModule` / `CairnModule` 에 import
- `OrchestratorService.runDaily` — github / local-git 둘 다 enabled 면 `Promise.all` 병렬 수집, dry-run 시 각각 stdout JSON dump
- 검증: `pnpm typecheck && pnpm lint && pnpm build` 통과
- 검증: cairn repo 자체를 임시 등록해 dry-run → 9 commit 정확히 잡힘, branch `feature/local-git-collector` 작업 브랜치 우선, `pushed: true` 정확, merge commit `--no-merges` 로 제외 확인
- 검증: `worklog.config.json` 없는 빈 환경에서도 부팅 OK — `WorklogConfigService` 가 빈 config fallback + warn 1 회
- 진행률 표 단계 2 ✅ 2026-05-06
- minor bump `0.2.1 → 0.3.0`

## 시행착오 / 결정

- **`branch` 필드 의미**: 한 commit 이 여러 branch 에 포함될 수 있음 (`git branch --contains` 가 여러 줄). 일지에는 작업 컨텍스트(작업 브랜치 이름)가 보여야 의미 있음. → `pickBranch`: `(detached HEAD)` 제외 후 트렁크 아닌 이름 우선, 트렁크밖에 없으면 첫 번째 (보통 main).
- **트렁크 목록**: `main` / `master` / `develop` / `release` + `release/` prefix. cairn 본인 레포는 ADR 0006 으로 develop 안 쓰지만, `worklog.config.json` 에 등록할 외부 회사 repo 가 git-flow 쓸 수 있어 develop / release 도 포함. hotfix/* 는 보통 작업 브랜치 성격이라 트렁크에서 제외.
- **`pushed` 판정**: `git branch -r --contains <sha>` 결과가 1 개 이상이면 pushed. fetch 안 함 — local 의 remote ref 가 stale 일 수 있으나 cairn 은 매일 1 회 실행이라 사용자가 그날 push 한 commit 이면 origin/* ref 도 갱신되어 있을 가능성 높음. fetch 비용 vs 정확도 트레이드오프 — 정확도 약간 양보.
- **author 필터**: `git config user.email` 자동 사용. 머신마다 다른 회사/개인 메일 분리 자연스러움. multi-author 케이스는 v1 밖.
- **에러 격리**: `Promise.allSettled` + repo 별 `error` 필드. 한 repo 가 git repo 가 아니거나 deleted 되어도 다른 repo 수집 계속.
- **date-window 재사용**: `github/date-window.ts` 를 `local-git` 에서 import. 도메인 결합 같지만 순수 함수라 surgical change 원칙 (CLAUDE.md §3) 따라 그대로. 추후 3 번째 collector 가 같은 함수 쓰게 되면 그때 `src/common/` 으로 추출하는 별도 refactor PR.
- **외부 송신 점검**: 응답 페이로드에 코드 본문 / diff / 절대경로 / 이메일 / full SHA 들어가지 않음. 타입 정의 자체에서 제외 (ADR 0003). dry-run 검증 시 출력 JSON 에서도 확인됨. redaction 단위 테스트는 단계 5 시점 도입.

## 다음

- 단계 3 — Notion 수집 (`feature/notion-collector`). `@notionhq/client`, `MY_NOTION_USER_ID` 헬퍼, `/v1/search` + 클라이언트 필터링.
