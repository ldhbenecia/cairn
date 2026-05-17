# 2026-05-17 — PR commits-on-date + involves 쿼리

> 진행 단계: **11 — PR commits-on-date + involves** ✅ (2026-05-17 완료)
> 상태: 완료

## 완료

- **`GithubApiClient.listPrCommitsInRange(token, owner, repo, n, since, until, authorLogin?)`** — `pulls/{n}/commits` 페이지네이션 (per_page 100, 안전상한 10 페이지). 각 commit 의 `commit.author.date` 가 KST 윈도우 안 + `commit.parents.length === 1` (merge commit 제외) + author login 매칭 (옵션) 통과한 commit 만 추출. shortSha (7자) + subject (첫 줄) + authoredAt 반환
- **새 PR commit 화이트리스트 타입** — `PrCommitOnDate { shortSha, subject, authoredAt }`. `GithubPrSummary.commitsOnDate: readonly PrCommitOnDate[]` 필드 신설
- **새 카테고리 `'involved'`** — `GithubActivityCategory` 에 추가. assignee / mentions / commenter / author 어느 식으로든 엮인 PR 을 잡음 (GitHub `involves:@me` qualifier 와 동일 의미)
- **Collector 쿼리 5개로 확장**:
  - `author:@me updated:${range}` (`authored`)
  - `author:@me merged:${range}` (`authored_merged`)
  - `reviewed-by:@me updated:${range}` (`reviewed`)
  - `commenter:@me updated:${range}` (`commented`)
  - **`involves:@me updated:${range}`** (`'involved'`, 신규)
  - dedup 후 categories 가 union. 한 PR 이 author + involved 면 카테고리 둘 다 표시
- **PR 당 commits-on-date fetch** — `toPrSummary` 가 `fetchSafeCommitsOnDate` 추가 호출. `assertNoForbiddenPayload` 로 subject sanitize, 금지 패턴 매칭 commit 만 drop (전체 drop X). subject 200자 cap
- **`healthCheck` 한 번 호출** — `myLogin` 얻어서 commits-on-date 필터에 사용 (본인 commit 만 노출). PR 당 호출 X, account 당 1회
- **Summarizer payload** — `DonePrItem` / `OpenPrItem` 에 `commitsOnDate` 노출. system prompt 에 "PR.body / commitsOnDate ... 핵심 키워드 / 작업 사항 활용" 한 줄 보강
- **spec 갱신** — fixture 에 `commitsOnDate: []` / `commitsOnDate: [{ ... }]` 추가
- 진행률 표 단계 11 ✅ 2026-05-17
- minor bump `0.11.0 → 0.12.0`

## 시행착오 / 결정

- **commits-on-date 도입 동기** — 단계 10 운영 검증에서 발견: 사용자가 회사 PR 6 개 잡혔는데도 "엄청 많이 했음" 체감 vs cairn 일지가 빈약. 회사 repo 가 `localGitRepos` 에 없으면 local commit 도 안 잡힘. 그러나 PR 단위로 묶인 commit 은 GitHub API 로 직접 fetch 가능 → 로컬 repo 등록 안 해도 PR 활동 깊이 보강
- **`involves:@me` 추가 이유** — 단계 10 운영 진단에서 PR #174 가 author/reviewer/commenter 어디에도 안 잡혔는데 `involves` 쿼리에선 잡힘 (사용자가 assignee 인 PR). `involves` 가 author OR assignee OR mentions OR commenter 의 logical OR 라 가장 넓은 catch-all. 단 reviewed-by 는 안 포함 → 별도 `reviewed-by:@me` 쿼리 유지
- **카테고리 union 으로 중복 허용** — `involves` 가 author / commenter 도 포함하므로 한 PR 이 `authored` + `involved` 양쪽으로 잡힘. summarizer 가 둘 다 보는 게 정보 보존 측면에서 OK (redundancy < 정보 손실). category Set 으로 union 되어서 자연스러움
- **commits-on-date 의 author 필터** — `myLogin` 으로 본인 author commit 만 cairn 일지에 박음. 다른 사람 commit 도 PR 에 있을 수 있음 (merge of someone else's branch / co-authoring) — 그건 본인 활동이 아니라 제외. 필요해지면 옵션화
- **merge commit 제외** — `c.parents.length > 1` 인 commit 은 자동 제외. 일지에 "merge from main" 같은 noise 안 들어가게
- **commit subject sanitize per-commit** — `assertNoForbiddenPayload` 가 매칭되는 commit 만 그 commit drop (전체 PR drop X). 한 PR 의 다른 정상 commit 은 유지. PR body sanitize 정책 (한 PR 의 body 가 패턴 매칭이면 body 전체 drop) 과 다른 정책 — commit 은 일자별 활동 단위라 단위 별로 처리
- **API 호출 수 증가 주의** — PR 한 개당 호출 1 추가 (commits-on-date) + account 당 1 추가 (healthCheck for login). 하루 PR 6 개 / account 2 개 면 +14 호출. GitHub rate limit 5000/시간 안에 한참 여유
- **카테고리 vs 정량 데이터** — `commitsOnDate` 가 정량 (commit 수 + subject) 이라 카테고리 (`authored` 등) 와 결합되면 의미 풍부. 단순 `authored` 만 있을 때보다 "오늘 N 개 commit 푸시함 + subjects" 정보가 일지 품질 ↑
- **로컬 repo 등록과의 관계** — commits-on-date 가 PR 묶인 commit 만 잡음. main / develop 직 push (PR 없이) 는 여전히 `localGitRepos` 가 답. 본인 한 명 personal 도구라 main 직 push 는 거의 없을 거 (GitHub Flow 의 main 보호 + ADR 0006). 회사 repo 도 보통 PR 흐름이라 cover 됨

## 다음

- **운영 검증** — `pnpm build` + `--force --date=2026-05-17` 로 어제자 일지 재발행 (work account PR 6 개 + 각 PR 의 그날 commit subject 들 포함되는지). 한국어 요약에서 `[CashwalkTeamwalkAdminServer] 캐시 관리 — 잔액·거래내역·매출전표 ...` 같이 commit subject 활용한 구체적 phrase 가 나오는지 확인
- 단계 11 검증 + 단계 10 까지의 sleep-aware backfill 한 주 운영 → 일지 / 롤업 품질 / 알림 noise / 비용 / 안정성 검증 → **1.0.0 결정**
- 그 후 v2 desktop 트랙 시작 (별도 plan `2026-05-17-cairn-v2-roadmap.md`)
