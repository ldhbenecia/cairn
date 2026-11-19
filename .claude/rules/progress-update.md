# Progress 일지 규칙

- 일지: `docs/progress/YYYY-MM-DD-<slug>.md` (로컬 날짜 기준, slug 는 작업 주제 kebab-case). 디렉토리 자체가 인덱스 — README 에 일지 목록을 모으지 않음
- `docs/progress/README.md` 는 단계별 진행률 표만 둠
- 작업 시작 시 일지 생성, sub-task 완료 시 "완료" 섹션에 즉시 추가. 섹션은 기존 일지 형식(완료 / 진행 중 / 시행착오·결정 / 다음)을 따름
- 단계 전체 완료 시: README 진행률 표 갱신(✅ + 완료 일자) + version bump + PR 머지
- 같은 slug 를 한 날에 두 번 만들지 않음 (이어쓰기)
- 장기적으로 살아남을 결정은 ADR 로 옮기고 일지에서 `→ ADR NNNN` 으로 참조
