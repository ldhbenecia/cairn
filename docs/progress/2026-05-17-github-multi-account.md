# 2026-05-17 — GitHub multi-account

> 진행 단계: **9 — GitHub multi-account** ✅ (2026-05-17 완료)
> 상태: 완료

## 완료

- **Config schema 확장** — `worklog.config.json` 에 `githubAccounts: [{ label, tokenEnv }]` 추가. `WorklogConfigService.getGithubAccounts()` accessor 도입
- **`GITHUB_TOKEN` 제거** — `.env.example` / `env.schema.ts` / `SecretsService.requireGithubToken` 모두 삭제. backward compat X (사용자 한 명, 마이그레이션 1 줄)
- **`GithubApiClient` 리팩터** — 단일 `octokit` 필드 → `Map<token, Octokit>` 캐시. 모든 메소드 (`healthCheck` / `searchPrs` / `listPrFileBasenames` / `fetchPrBody`) 가 token 인자를 받음. SecretsService 의존 제거
- **`GithubCollectorService` 재구성**:
  - `getGithubAccounts()` 로 등록된 account 들 순회
  - `Promise.allSettled` 로 account 별 독립 실행 — 한 account 실패해도 다른 account 는 진행
  - 각 account 안에서 기존 4 query (`authored` / `authored_merged` / `reviewed` / `commented`) 병렬
  - dedup key 를 `account/owner/repo#number` 로 (다른 account 가 같은 PR 보는 케이스도 분리)
  - `GithubModule` 에 `SecretsModule` / `WorklogConfigModule` import 추가
- **`GithubPrSummary` 화이트리스트** — `account: string` 필드 추가. summarizer 가 그대로 노출 (요약에서 회사/개인 구분 가능). 토큰 자체는 절대 안 나감
- **`GithubActivity.error?` → `accountErrors?: [{ account, error }]`** — 다중 account 실패 표현. summarizer-tools 의 `SourceErrorsView.github` 도 array 형식으로 정렬 (localGit / notion 패턴과 일관)
- **`CairnError.githubTokenMissing(envVar: string)`** — 시그니처에 env 이름 받게 변경
- **Summarizer payload** — `DonePrItem` / `OpenPrItem` 에 `account: string` 필드. spec 픽스
- **`.env.example`** — `GITHUB_TOKEN` 삭제, `GITHUB_TOKEN_PERSONAL` / `GITHUB_TOKEN_WORK` 추가
- **`worklog.config.example.json`** — `githubAccounts` 예시 (`personal` / `work` 두 항목)
- **SETUP.md / SETUP.ko.md** — §4 (PAT 발급은 계정마다) + §6 (`.env` 의 multi-token) + §7 (`githubAccounts` 자유 array, label / tokenEnv 자유 작명 강조) 갱신
- **v2 로드맵 plan** — [docs/plans/2026-05-17-cairn-v2-roadmap.md](../plans/2026-05-17-cairn-v2-roadmap.md). engine 트랙 (v0.10 → v0.11 → 1.0) + desktop 트랙 (v0.1 셸 / v0.2 마법사 / v0.3 OAuth Device Flow / v0.4 Keychain) 정리 + 신규 ADR 후보 + 책임 분배표
- 진행률 표 단계 9 ✅ 2026-05-17
- minor bump `0.9.0 → 0.10.0`

## 시행착오 / 결정

- **backward compat 안 함** — 사용자 = 본인 한 명. 단일 `GITHUB_TOKEN` 분기를 유지하면 코드 분기 / 타입 union (`account: string | null`) 늘어남. 마이그레이션은 `.env` 1 줄 + `worklog.config.json` 1 블록 추가라 사용자 부담 적음
- **dedup key 에 account 포함** — 회사 owner / 개인 owner 가 같은 PR 을 둘 다 보는 케이스는 거의 없지만, 있더라도 account 별로 따로 보여주는 게 사용자에게 더 의미 있음 (어느 계정으로 본 PR 인지 컨텍스트 필요)
- **GitHub `myLogin` 별도 필드 안 둠** — Notion 의 `myUserId` 와 달리 GitHub 의 `author:@me` 는 token 의 인증된 사용자를 자동 반영. account 마다 다른 사용자라도 동일하게 동작
- **per-account 추가 보호 (회사 PR body redaction 옵션 등) 안 함** — 이미 모든 PR body 에 `sanitize` + 800 char cap 적용. 회사 / 개인 차별 보호는 over-engineering. 필요 시점에 `redactBody: true` 같은 옵션 add 하면 됨
- **`GithubActivity.error` 단일 → `accountErrors[]` 변경** — multi-account 라 전체 실패 / 부분 실패 의미가 달라짐. localGit / notion 의 array 패턴과 일관. summarizer 가 account 별로 별도 표시 가능
- **schema 미래 확장성** — `githubAccounts[].label` / `tokenEnv` 둘 다 자유 문자열. 데스크탑 앱 등장 시 라벨 자동 슬러그 / `tokenEnv` 가 Keychain reference 로 진화 가능. stable `id` (UUID) 같은 건 데스크탑 앱 도입 시점에 추가 — 지금 박으면 사용자가 손으로 UUID 채워야 해서 디버그 부담
- **v2 로드맵 doc 우선 작성** — desktop / OAuth Device Flow / Keychain / publisher abstraction 결정사항이 휘발되기 전에 plan 으로 박음. 본 PR 안에서 같이

## 다음

- **단계 10 — sleep-aware backfill** — `RunAtLoad: true` 모든 plist 에 + cairn 에 "지난 N 일 빠진 날짜 자동 backfill" 도입. `pmset wake` opt-in (`ops/install.sh --with-wake`). 0.11.0 minor
- 단계 9 + 10 머지 후 며칠 운영 → 일지 / 롤업 품질 / 알림 / 비용 / 안정성 검증 → 1.0.0 결정
- v2 desktop 트랙은 별도 plan (`2026-05-17-cairn-v2-roadmap.md`) 위에서 별도 PR 시리즈로 진행 (별도 repo / monorepo 결정도 그 시점에 ADR 0011)
