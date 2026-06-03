# 0016. 활동 수집 날짜 윈도우를 KST → 머신 로컬 타임존

- 상태: accepted
- 작성일: 2026-06-03

## 맥락

core 의 `date-window.ts` 는 worklog "날짜" 와 활동 수집 윈도우를 **KST(UTC+9) 하드코딩**으로 계산했다 (`kstDateToUtcWindow`, `todayKstIsoDate`). 본인용 한국 도구일 땐 문제없었다.

이제 데스크톱 앱을 일반 사용자에게 배포하면서 사용자가 **어느 타임존에 있을지 알 수 없다**. KST 가정이면 한국 밖 사용자는 "오늘"이 어긋나 엉뚱한 날짜의 활동을 모으고, 자동 발행(데스크톱 앱이 사용자 로컬 시각에 발화, ADR 0015)과도 어긋난다. 타임존 규칙(`.claude/rules/timezone.md`)에 부채로 명시돼 있었다.

## 결정

날짜/윈도우 계산을 **머신 로컬 타임존** 기준으로 일반화한다.

- `kstDateToUtcWindow` → `localDateToUtcWindow`: "YYYY-MM-DD"(로컬 캘린더 날짜)를 `new Date(y, m-1, d, ...)`(로컬 생성자)로 해석 → 그 날 00:00:00~23:59:59(로컬)의 UTC 윈도우. 로컬 생성자가 머신 TZ·DST 를 반영.
- `todayKstIsoDate` → `todayLocalIsoDate`: `new Date()` 의 로컬 캘린더 날짜.
- 호출처(github/notion/local-git collector, cli-args) 일괄 교체.
- 단위 테스트로 "윈도우가 로컬 하루를 정확히 덮는지" 검증.

**한국 사용자는 로컬 TZ = KST 라 동작이 동일** — 회귀 없음.

## 대안

- 설정으로 TZ 지정: 불필요한 복잡도. 기본은 머신 로컬이 자연스럽고, 필요해지면 옵션을 더한다.
- KST 유지: 국제 배포와 양립 불가. 기각.

## 결과

- 비-KST 사용자도 자기 로컬 날짜 기준으로 정확히 수집·발행.
- 표시·발행 시각도 로컬 기준이라 자동 발행 스케줄(ADR 0015)과 일관.
- 향후 명시적 TZ 설정이 필요하면 별도 옵션으로 확장.
