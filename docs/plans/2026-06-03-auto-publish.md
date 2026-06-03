# 2026-06-03 — 자동 발행 (데스크톱 앱 소유)

> 살아있는 plan. 그룹 2. 직전: [2026-06-03-feedback-update-prompts.md](2026-06-03-feedback-update-prompts.md) 그룹 1 머지(PR #42).
> 결정(2026-06-03 사용자): 자동 발행을 **데스크톱 앱이 소유**, **opt-in 동의 + 발행 전 확인 옵션**, billing/커스텀 프롬프트는 최후 보류.

## 배경 — 현재 동작과 문제

- 지금 자동 발행 = **launchd** 가 헤드리스 **core 엔진**을 정해진 시각 + 로그인 시(RunAtLoad) 실행. 데스크톱 앱과 무관.
- 문제: 앱을 켜도 밀린 날짜가 자동 처리 안 됨(앱은 UI 일 뿐), 자동 발행이 도는지 사용자가 알 수 없음, **사용자 Claude 크레딧을 쓰는데 동의 흐름이 없음**.

## 결정 (→ ADR 0015)

- **데스크톱 앱이 자동 발행 소유**. 배포에선 앱이 트레이 상주라 (a) 실행 시 밀린 날짜 백필 (b) 매일 지정 시각 발화 (c) 진행/결과 알림 (d) 동의 토글을 직접 관리.
- launchd 는 제거하지 않음(앱이 아예 안 떠 있는 헤드리스/CLI 사용자용 보조). **중복 발행은 publisher 의 already-published skip 으로 무해**.

## 범위 (이번 PR 시리즈)

### settings 에 autoPublish 추가
```
autoPublish: {
  enabled: boolean        // 기본 false (opt-in = 동의)
  time: string            // "HH:mm" 매일 발화 시각, 기본 "19:00"
  backfillDays: number    // 실행 시 백필 일수, 기본 7
  confirmBeforeRun: boolean // true 면 자동 실행 X, 알림으로 확인 받음. 기본 false
}
```

### main 스케줄러 (auto-publish.ts)
- 앱 ready + settings 변경 시 재설정
- **실행 시 백필**: enabled 면 밀린 날짜 확인 → confirmBeforeRun 따라 실행/알림
- **매일 발화**: 다음 `time` 까지 타이머. 발화 시 daily 발행(+backfill)
- 발행은 기존 `runCore(daily, {backfillDays})` 재사용
- **동의**: enabled 가 동의. confirmBeforeRun=true 면 자동 실행 대신 알림(클릭 시 앱 포커스 → 사용자가 수동 발행)
- **가시성**: 시작/완료 시스템 알림 + (창 열려 있으면) 진행 표시
- **알림에 cairn 로고**: Electron `Notification` `icon` 에 cairn 아이콘 경로 지정 (수동 발행 결과 알림 포함 전체 적용)

### Preferences "자동 발행" 탭/섹션
- 사용 토글(opt-in) + 발화 시각 + 백필 일수 + 발행 전 확인 토글
- 크레딧 안내 문구("자동 발행은 Claude 크레딧을 사용합니다")

## 타임존 / 국제화 (중요)

데스크톱 앱 사용자는 한국뿐 아니라 **어디에 있을지 모름**. 두 층위로 분리:

- **스케줄 발화 시각 (이번 작업)** — 사용자 **로컬 타임존** 기준. main 의 `new Date()`/`setHours()` 는 기본 로컬이라 UTC 아님. setUTC* 금지.
- **엔진의 worklog "날짜" 산정 (별도 작업, 국제 배포 전 필수)** — 현재 core `date-window.ts` 가 **KST 하드코딩**(`todayKstIsoDate`, `kstDateToUtcWindow`). 한국 밖 사용자는 "오늘"이 어긋남. core 의 날짜 윈도우를 **머신 로컬 TZ(또는 설정 가능 TZ)** 기준으로 일반화해야 함. 날짜 경계 수학 + 테스트 동반 → 별도 PR/ADR. **이 작업 전까지 자동 발행은 한국 사용자 기준으로만 정확.**

## 보류 / 후속

- ~~weekly/monthly 자동 발화~~ ✅ — **일간/주간/월간 독립 토글**(주간/월간은 크레딧 차등 안내). 월요일=weekly(어제 anchor=지난주), 1일=monthly(어제=지난달), daily→weekly→monthly 순차
- confirmBeforeRun 의 알림→인앱 확인 다이얼로그 고도화
- launchd 정리/이관 안내
- **커스텀 프롬프트 = billing 기능 후보로 최후 보류** (그룹 1 plan 의 그룹 3 → billing 으로 흡수)
- **Liquid Glass 스타일 토글** (Preferences > 화면) — 애플 Liquid Glass 풍 frosted/translucent 디자인을 ON/OFF. 현재 flat = OFF, 글래스 구현 시 ON. 지금은 미착수. 참고: https://getdesign.md/apple/design-md

## 관련 plan (이미 기록됨)

- **지표 추적 / billing / 후원** 아이디어 → [2026-06-03-feedback-update-prompts.md](2026-06-03-feedback-update-prompts.md) **그룹 4** (PR #42 머지됨). GitHub Releases 다운로드 수 → Aptabase opt-in 익명 분석, 무료+후원 / one-time Pro 라이선스, GitHub Sponsors·Ko-fi.
- **커스텀 프롬프트**: 위 billing 의 Pro 기능 후보로 흡수 — 최후 보류.

## 버전

- 기능 추가 → desktop minor (v0.1.8 → v0.2.0?), root v0.15.9 → v0.16.0. PR 머지 시 확정.
