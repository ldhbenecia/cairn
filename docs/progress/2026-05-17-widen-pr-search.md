# 2026-05-17 — PR 검색 lookback 확장 (backfill 누락 commit 잡기)

> 진행 단계: **12 — PR 검색 widening + day-relevance post-filter** ✅ (2026-05-17 완료)
> 상태: 완료

## 완료

- **`--lookback-days=N`** CLI 옵션 신설 (default 14, 0-60). 0 이면 기존 narrow 동작
- **`RunOptions.lookbackDays`** 필드 + cli-args 의 `parseLookbackDays`
- **collector 의 search 분리**:
  - `involves:@me updated:${widenedRange}` — 그날 기준 지난 N 일까지 update 된 PR
  - `reviewed-by:@me updated:${range}` — narrow (그날 정확히)
  - `commenter:@me updated:${range}` — narrow (그날 정확히)
- **`computeLookbackStartIso`** — date 의 KST 시작 - N 일 ISO 반환 (lookbackDays=0 이면 dayStartIso)
- **post-filter `belongsToDay`** — 각 enrich 된 PR 이 그날 활동 신호 있을 때만 유지:
  - `reviewed` / `commented` 카테고리 → keep (narrow query 가 이미 day-specific)
  - `authored_merged` → keep (mergedAt in day window)
  - `commitsOnDate.length > 0` → keep (그날 본인 commit push)
  - `createdAt` 이 day window → keep (그날 PR 생성)
  - 그 외 → drop (involves widened 로 잡혔지만 그날 신호 없음)
- 진행률 표 단계 12 ✅ 2026-05-17
- minor bump `0.12.0 → 0.13.0`

## 시행착오 / 결정

- **문제** — 단계 11 까지의 collector 는 daily X 의 search 를 그날 KST 윈도우에만 limit. GitHub `updated:` 필터는 PR 의 **현재 (최신) `updated_at`** 만 매칭 → multi-day push 패턴 (같은 PR 에 5/11, 5/12, 5/13 push 후 5/15 에 추가 push 로 updated_at = 5/15 로 밀림) 에서 backfill 시 과거 일자의 PR 자체를 못 잡음 → `listPrCommitsInRange` 호출도 못 함 → commit 누락
- **검증** — `pulls/{n}/commits` 직접 호출로 PR #962 안에 5/8 ~ 5/15 까지 매일 본인 commit 30+ 개 박혀있는 거 확인. cairn 의 day-narrow search 가 이걸 못 가져오는 게 입증됨
- **해결 방향** — 1단계 search 만 widening (involves 만, lookback N 일). `listPrCommitsInRange` 의 author.date 필터는 그대로 → 그날에 정확히 push 된 commit 만 골라냄
- **lookbackDays default 14** — 한 PR 에 2 주 push 패턴 cover. backfill 7 일 + 그 전 한 주 정도 여유. 사용자가 더 길게 원하면 `--lookback-days=30` 등으로 조정
- **`reviewed-by` / `commenter` 는 narrow 유지** — 이 두 쿼리는 본인이 그날 review/comment 한 PR 정확히 매칭. widening 시키면 다른 날 review 한 PR 이 그날 daily 에 끼어들어 noise
- **post-filter 의 inclusion 신호 4 종**:
  - narrow query 매칭 (reviewed / commented) — 이미 day-specific
  - authored_merged — mergedAt 이 day window 안
  - commitsOnDate.length > 0 — 본인이 그날 push
  - createdAt 이 day window 안 — 그날 PR 생성
  - 4 신호 중 하나라도 있으면 keep, 없으면 widening 으로 잡힌 PR 이라도 drop. day-relevance 엄격하게
- **`mentions` / `assignee` 만으로 엮인 PR 의 거취** — involves widening 으로 잡히는데 위 4 신호 다 없음 → drop. 본인이 그날 활동 안 했으면 일지에 안 박혀야 자연스러움. 본인 assignee/mention 정보만 있는 PR 은 그날 활동 X
- **API 호출 수 영향** — daily 한 번에 involves widening 으로 잡힌 PR N 개 × listCommits 호출. user 작업량 보면 N ≈ 10~30 정도. 5000/시간 한도 안에 여유. backfill 7 일도 OK
- **skipCommitsOnDate 휴리스틱 그대로** — `authored_merged && createdAt < sinceIso` 인 경우는 여전히 merge commit 외엔 push 없는 패턴이라 skip. widening 후에도 유효

## 다음

- **운영 검증** — `pnpm build` + `--mode=daily --date=2026-05-11 --force` (또는 backfill 모드) 로 5/11 일지 재발행. 회사 PR commits 그날 push 한 것들 (`8478ee6`, `b7fcf45`, `bbdd909` 등) 이 일지에 잡히는지 확인
- 단계 9~12 통합 운영 며칠 → 일지 품질 + 비용 + 알림 noise → **1.0.0 결정**
- 그 후 v2 desktop 트랙 (별도 plan `2026-05-17-cairn-v2-roadmap.md`)
