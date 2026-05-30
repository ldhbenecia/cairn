# 2026-05-30 — desktop-scaffold

> 진행 단계: **14 — v0.1 desktop 셸** (시작)
> 상태: 진행 중
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.1 — packages/desktop 스캐폴드
  - electron-vite + React 19 + TS + Tailwind v4 + Radix
  - 빈 윈도우 dev 실행 OK 까지가 이 PR 의 산출물
  - UI / 트레이 / core spawn / 알림 은 후속 PR

## 시행착오 / 결정

- **UI 스택 = React + Tailwind v4 + Radix** (vanilla 가 아닌 이유)
  - Linear/Framer/Apple 톤은 디자인 토큰 일관성이 핵심 → vanilla CSS 로는 settings / log viewer 가 들어오는 순간 무너짐
  - 어차피 v0.2 셋업 마법사 진입 시 React 필요 → 한 번에 가는 게 합리적
  - 별도 ADR 0012 로 기록
- **번들러 = electron-vite** — Electron + React + TS + HMR 표준 패턴, electron-builder 와 호환 좋음
- **dual-track 버전 정책** — engine / desktop 자체 lifecycle. root 는 진행 단계 신호 (ADR 0005 따라 patch / minor), desktop 은 자체 v0.0.1 부터 시작 (v0.1 셸 완료 = desktop v0.1.0). 단계 14 완료 시 ADR 0013 후보로 승격
- **PR 시리즈 버전 = patch bump** (ADR 0005) — 14.1 ~ 14.6 patch, 14.7 단계 완료 = root v0.15.0 + desktop v0.1.0
- **launchd 자동 발화 알림은 v0.1 변경 X** — 수동 trigger 만 cairn 번들 native Notification 으로. launchd owner 이전은 v0.5+

## 다음

- 14.1 머지 후 14.2 (트레이 아이콘 + 메뉴 + 작은 윈도우 토글) 진행
