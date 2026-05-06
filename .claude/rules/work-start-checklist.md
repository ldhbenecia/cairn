# 작업 시작 체크리스트

이 레포에서 새 작업을 시작할 때 다음 순서로 컨텍스트를 잡는다.

1. **현재 단계 파악**
   - [docs/progress/README.md](../../docs/progress/README.md) 진행률 표 확인 — 어디까지 ✅ 인지
   - 가장 최근 일지 1~2 개 훑기 (`docs/progress/YYYY-MM-DD-*.md`)
2. **관련 ADR 확인**
   - [docs/decisions/](../../docs/decisions/) — 비자명한 결정. 작업 주제와 겹치면 우선 참조
3. **plan 확인**
   - [docs/plans/](../../docs/plans/) — 단계별 구현 순서·범위·외부 API 메모
4. **세부 룰 떠올리기**
   - [.claude/rules/](.) — 명명·보안·결정·일지 규칙

작업 진행 중 비자명한 결정이 생기면 `decisions-workflow.md` 따라 ADR 추가, 그 외 흐름·맥락은 일지에 기록(`progress-update.md`).
