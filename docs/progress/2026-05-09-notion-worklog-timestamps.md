# 2026-05-09 — notion worklog timestamps

> 진행 단계: 단계 4 ~ 5 사이 미니 PR
> 상태: 완료

## 완료

- `NotionApiClient.createWorklogDatabase` 의 `initial_data_source.properties` 에 두 column 추가
  - `Created at`: `created_time` type — Notion 이 페이지 생성 시각 자동 채움
  - `Last edited at`: `last_edited_time` type — 페이지 마지막 편집 시각 자동 갱신
- 사용자가 일지 페이지 작성 시간 / Status `final` 처리 시각 등 DB view 에서 한눈에 확인 가능
- 검증: 사용자가 worklog.databaseId / dataSourceId 두 줄 지우고 cairn 재실행 → 새 schema 로 DB 자동 재생성. cairn 페이지에 새 inline DB + 두 column 확인 완료
- patch bump `0.5.2 → 0.5.3`

## 시행착오 / 결정

- **기존 DB schema 는 어떻게**: 옵션 A (Notion UI 에서 사용자가 직접 두 column 추가) vs B (worklog config 두 줄 지우고 cairn 자동 재생성, 이전 일지 페이지 손실) vs C (cairn 자동 schema migration via dataSources.update). 사용자가 B 선택 — 가장 단순. C 는 미래 다른 schema 변경 시점에 다시 검토 가능.
- **column 이름 영어 (`Created at` / `Last edited at`)**: 기존 schema (`Title` / `Date` / `Tags` / `Source counts` / `Status`) 와 일관. Notion 한국어 UI 에서도 잘 보임.
- **별도 column 추가 vs Notion 자동 표시**: Notion 페이지는 created_time / last_edited_time 메타가 항상 자동 — DB view 에 노출하려면 column 으로 명시해야 함. 두 column 명시.

## 다음

- 라이센스 변경 PR (AGPL v3) 별도
- 단계 5 — Summarizer agent harness
