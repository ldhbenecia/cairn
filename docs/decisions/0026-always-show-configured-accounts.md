# 0026. 발행 Done — 설정 계정 항상 표시(빈 계정 None) + 그날 총 커밋 합산

- 상태: accepted
- 작성일: 2026-06-19
- 관련: [0024](0024-per-account-summary-separation.md) 를 확장(supersede 아님)

## 맥락

ADR 0024 로 계정별 요약 분리를 도입했지만, 그 동작은 **"활동이 있는 계정이 2개 이상일 때만"** 계정별 `### Work`/`### Personal` 서브헤딩으로 그룹화했다. 그래서 어느 날 Work 만 작업하면(Personal PR 0건) 서브헤딩 없이 평문으로 떨어지고, "오늘 Personal 은 안 했다"는 사실이 일지에 남지 않았다. 사용자는 GitHub 계정을 Work·Personal 둘 다 상시 등록해 두고, **매일 두 계정의 작업 유무를 한눈에** 보고 싶어 했다.

또 "Source counts" 메타에는 `gh:PR수 / git:로컬커밋수` 가 들어갔는데, 사용자는 GitHub PR 커밋(Work 계정 포함)과 로컬 커밋을 **소스 구분 없이 그날 총 커밋 하나**로 보고 싶어 했다("로컬깃이랑 구분하지말고 합치셈").

## 결정

1. **설정된 계정 전체를 흐른다**: `GithubActivity.accountLabels` 에 worklog.config 의 GitHub 계정 라벨 전체(활동 유무 무관)를 담아 수집기가 채운다. 요약 payload `configuredAccounts`, 발행자 `buildDoneBlocks(bullets, accountLabels)` 로 전달.
2. **설정 계정 ≥ 2 → 항상 모든 계정 서브헤딩**: 발행자가 Done 을 `### Work`/`### Personal` 로 내되, **작업 없는 계정은 `None`** 으로 명시. 1개 이하면 ADR 0024 의 기존 동작(접두 있으면 그룹, 없으면 flat).
3. **프롬프트**: `configuredAccounts.length > 1` 이면 모든 GitHub PR bullet 에 `[Label]` 접두(설정 라벨 그대로). 활동 없는 계정은 bullet 을 만들지 않음 — None 은 발행자가 붙인다(모델이 placeholder 만들지 않게).
4. **그날 총 커밋 합산**: `formatSourceCounts` 의 커밋 수 = 모든 GitHub 계정 PR 의 `commitsOnDate` 합 + 로컬 git 커밋 합. (`gh:` PR 수는 유지, `git:` 키는 backward-compat 위해 유지하되 값이 "총 커밋"으로 의미 확장.)

## 대안

- **활동 있는 계정만 표시(0024 그대로)**: "오늘 Personal None" 을 못 보여줘 기각.
- **요약 스키마를 계정별 grouped 구조로**: egress-safe flat 스키마를 깨고 변경 폭 큼 — 접두 + 발행자 파싱이 더 작고 안전(0024 와 동일 판단).
- **`git:` → `commit:` 키 rename**: 과거 발행 페이지(`git:`)의 desktop 파서 호환이 깨져 기각. 값 의미만 확장.

## 결과

- 계정 2개 사용자는 매일 일지 Done 이 `### Work` / `### Personal`(빈 날 None)로 일관 표시. Markdown/PDF 내보내기도 발행 블록을 읽어 동일 반영.
- 단일 계정 사용자 무영향.
- Source counts 의 커밋 수가 "그날 총 커밋(전 계정+로컬)"으로 바뀜 — desktop 리스트가 자동 반영(파서 무변경).
- 같은 repo 를 GitHub PR + 로컬 양쪽에서 잡으면 커밋이 이중 계수될 수 있음(엣지) — 사용자가 "총합" 을 원해 수용.
- 구현: PR(이번 0.23.1 배치). 단위 테스트: `done-grouping.spec`(빈 계정 None), `summarizer-tools.spec`(configuredAccounts).
