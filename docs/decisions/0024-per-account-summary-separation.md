# 0024. GitHub 계정별(Work/Personal) 요약 분리

- 상태: accepted
- 작성일: 2026-06-15

## 맥락

사용자는 GitHub 토큰을 여러 개(예: Work·Personal) 등록한다. 기존 요약은 모든 계정의 PR 을 한데 합쳐 출력해 "어느 계정 일인지" 구분이 안 됐다. `GithubPrSummary` 는 이미 PR 마다 `account` 라벨을 보존하고 있었고(collector 가 주입), `get_activity` payload 의 done/inProgress PR 에도 계정이 들어 있었다 — 즉 데이터·도구는 충분했고 빠진 건 출력 표현뿐이었다.

## 결정

- `get_activity` payload 에 distinct **`accounts`** 배열(중복 제거·정렬)을 추가 → 프롬프트가 "계정이 2개 이상인가"를 명확히 판단.
- daily 프롬프트: `accounts.length > 1` 이면 doneBullets/inProgressBullets 의 PR bullet 에 `[Work]`/`[Personal]` **접두**를 붙이고 계정별로 정렬. 단일 계정이면 접두 없음.
- rollup 프롬프트: daily bullet 의 계정 라벨이 있으면 themes/highlights 에서 계정 구분 유지.
- **발행 표현(개정)**: 인라인 `[Work]` 접두는 가독성이 떨어진다는 피드백 → 발행자가 Done 의 `[Account]` 접두를 파싱해 **`### Work` / `### Personal` 서브헤딩(heading_3)** 으로 그룹화하고 접두는 제거한다. 단일 계정·접두 없으면 기존 flat.
- 계정 라벨은 사용자 정의라 egress 안전(diff/경로/토큰 아님). `assertNoForbiddenPayload` 통과. 단 라벨에 회사명·식별정보를 넣지 않도록 권고.

## 대안

- **summarizer 스키마를 grouped 구조로 변경**: done 을 계정별 객체로 받기. egress-safe flat 스키마를 깨고 변경 폭이 커 기각. 접두+발행자 파싱이 더 작고 안전.
- **인라인 접두 유지**: 구현은 가장 작지만 가독성 나쁨(사용자 피드백) → 발행자 서브헤딩으로 개정.

## 결과

- 계정 ≥2 면 일지 Done 이 `### Work` / `### Personal` 로 묶여 표시. Markdown/PDF 내보내기도 발행된 블록을 읽으므로 동일하게 반영.
- 단일 계정 사용자는 무영향(접두·서브헤딩 없음).
- 구현: PR #147(payload accounts + 접두 프롬프트), 후속 PR(발행자 서브헤딩 + 인라인 접두 파싱).
