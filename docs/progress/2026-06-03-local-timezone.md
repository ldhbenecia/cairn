# 2026-06-03 — local-timezone

> 진행 단계: **엔진 KST → 로컬 TZ 국제화** (완료)
> 상태: 완료
> ADR: [0016](../decisions/0016-local-timezone-date-windows.md) · 규칙: [timezone.md](../../.claude/rules/timezone.md)

## 완료
- core `date-window.ts` KST 하드코딩 제거 → **머신 로컬 TZ** 기준
  - `kstDateToUtcWindow` → `localDateToUtcWindow` (로컬 캘린더 날짜 → 로컬 00:00:00~23:59:59 의 UTC 윈도우, DST 반영)
  - `todayKstIsoDate` → `todayLocalIsoDate`
- 호출처 일괄 교체: cli-args, notion/github/local-git collector
- 단위 테스트 추가(`date-window.spec.ts`) — 윈도우가 로컬 하루를 정확히 덮는지, ISO 포맷, 잘못된 입력
- 타임존 규칙의 "부채" 항목을 해결됨으로 갱신

## 시행착오 / 결정
- 한국 사용자는 로컬 TZ = KST 라 동작 동일(회귀 없음) — ADR 0016
- 자동 발행(ADR 0015)이 사용자 로컬 시각에 발화하는 것과 이제 날짜 산정도 로컬로 일관
- 테스트는 러너 TZ 에 의존하지 않도록 "로컬 컴포넌트(getHours 등)" 로 구조 검증

## 다음
- 명시적 TZ 설정 옵션은 수요 생기면 별도 추가
