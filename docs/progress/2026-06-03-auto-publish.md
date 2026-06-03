# 2026-06-03 — auto-publish

> 진행 단계: **그룹 2 — 자동 발행 (데스크톱 앱 소유)** (마무리)
> 상태: 완료
> plan: [2026-06-03-auto-publish.md](../plans/2026-06-03-auto-publish.md) · ADR: [0015](../decisions/0015-desktop-owned-auto-publish.md)

## 완료
- **자동 발행을 데스크톱 앱이 소유** (ADR 0015) — launchd 와 공존(중복은 publisher skip 으로 무해)
- main `auto-publish.ts` 스케줄러: 앱 ready 시 **실행 시 백필** + 매일 지정 시각 발화. 발화 시각 = **사용자 로컬 타임존**(rules/timezone.md)
- settings 에 `autoPublish { enabled, time, backfillDays, confirmBeforeRun }` (기본 enabled=false = opt-in 동의)
- `confirmBeforeRun=true` 면 자동 실행 대신 확인 알림(클릭 시 앱 포커스)
- Preferences **자동 발행 탭** — 사용 토글 + 발행 시각(time) + 백필 일수 + 발행 전 확인 + 크레딧 안내 문구
- **알림에 cairn 로고**(notifier `icon`/번들 아이콘) + 시작/결과 알림. electron-builder extraResources 에 icon.png 추가
- settings 변경 시 스케줄러 reconfigure

## 시행착오 / 결정
- launchd → 데스크톱 앱 스케줄러 이전 (ADR 0015). 앱이 배포에서 트레이 상주라 가능
- 동의 = opt-in(켜는 게 동의) + 발행 전 확인 옵션. 사용자 Claude 크레딧 소비라 기본 OFF
- **타임존 규칙 신설**(rules/timezone.md) — KST 단정 금지. 엔진 date-window.ts 의 KST 하드코딩은 국제 배포 전 별도 처리 필요(부채로 명시)
- CLAUDE.md 의 cairn 컨텍스트를 `.claude/cairn-context.md` 로 분리 + @import (루트는 영어 가이드만)

## 다음
- 엔진 날짜 윈도우 로컬 TZ 일반화(국제화), weekly/monthly 자동 발화, billing(Supabase) — 후속
