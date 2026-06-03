# 2026-06-03 — auto-publish-rollup

> 진행 단계: **자동 발행 weekly/monthly 확장 (일간/주간/월간 독립 토글)** (완료)
> 상태: 완료
> plan: [2026-06-03-auto-publish.md](../plans/2026-06-03-auto-publish.md) · ADR: [0015](../decisions/0015-desktop-owned-auto-publish.md)

## 완료
- 자동 발행을 **일간 / 주간 / 월간 독립 토글**로 분리 (단일 `enabled` 폐기 → `daily`/`weekly`/`monthly`)
  - 주간/월간은 별도 summarization 이라 크레딧을 더 써서, 각각 opt-in 하도록 분리 + 설명에 명시
  - 월요일 → weekly, 매월 1일 → monthly. 시각·발행 전 확인은 공유, 백필은 daily 전용
  - 롤업은 "완료된 기간" 정리 → **어제(이미 끝난 날)** 를 anchor (월요일 weekly=지난주, 1일 monthly=지난달)
  - 하루에 켜진 모드들 daily→weekly→monthly **순차 실행** (이미 발행된 건 엔진 precheck skip)
- `runCore`/`CoreRunOptions` 에 `date?` 추가 → `--date` 로 롤업 기간 anchor 전달
- settings 레거시 `enabled` → `daily` 로 이관(readSettings)
- 발화 시각/요일·날짜 전부 사용자 로컬 TZ 기준 (rules/timezone.md, ADR 0016)
- 스케줄러 타이머는 셋 중 하나라도 켜지면 매일 시각에 동작, due 모드만 발화

## 시행착오 / 결정
- 처음엔 단일 토글에 묶었으나, 주간/월간 크레딧 부담을 사용자가 개별 통제하도록 **토글 분리**로 변경
- 한계: 앱이 해당 요일/날짜에 안 떠 있으면 그 회차 건너뜀(daily 는 backfill catch-up, 롤업은 미backfill)

## 다음
- 롤업 missed 회차 catch-up, 발화 요일/날짜 커스텀(필요 시)
