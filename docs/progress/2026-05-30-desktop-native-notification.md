# 2026-05-30 — desktop-native-notification

> 진행 단계: **14 — v0.1 desktop 셸** (PR 14.5)
> 상태: 진행 중
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)
> 직전 일지: [2026-05-30-desktop-core-spawn](2026-05-30-desktop-core-spawn.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.5 — native Notification + 알림 클릭 시 노션 URL 자동 열기
  - `src/main/notifier.ts` 신규 — `sendResultNotification(mode, result)` 함수
  - core-runner 의 close handler 가 호출 → 수동 trigger (tray ⌘1/2/3 + renderer 발행 버튼) 둘 다 알림 받음
  - 알림 title/body 결과 분기: 발행 완료 / 이미 발행됨 / 활동 없음 / 실패
  - 알림 클릭 시 노션 페이지 자동 열림 (URL 있으면, skipped 의 fallback URL 포함)
  - tray 의 기존 자동 `shell.openExternal` 제거 (알림 클릭으로 통일)

## 시행착오 / 결정

- **알림 발사 위치 = core-runner 의 close handler 안에서 직접** — tray / IPC handler 별로 호출하면 중복 / 누락 위험. runCore 가 종료 시점에 한 번만 발사. 호출자 (tray / renderer) 는 결과 활용만
- **알림 클릭 핸들러 = shell.openExternal** — 노션 페이지 URL 있으면 외부 브라우저로. URL 없는 케이스 (활동 없음 / 실패) 는 클릭해도 noop (또는 메인 윈도우 focus)
- **번들 ID = `io.cairn.desktop`** (electron-builder.yml) — Electron Notification API 는 그 번들 owner 로 발사. macOS 가 알림 클릭을 cairn 앱으로 라우팅 → 이전 osascript 의 Script Editor 사이드이펙트 해결 (v0.1 셸 의 가장 큰 효용 중 하나)
- **dev 환경 알림** — Electron Helper 가 alert 일 수도. packaged `.app` 에선 io.cairn.desktop. dev 검증은 일단 "알림 떠 + 클릭 시 노션 열림" 정도 확인하고, 정확한 owner 검증은 14.7 packaging 후
- **launchd 자동 발화 알림은 v0.1 변경 X** — 여전히 engine 의 osascript. desktop 으로 owner 이전은 v0.5+ 의 별도 PR
- **알림 클릭 라우팅 = 앱 안 진입 (외부 노션 X)** — 사용자 명시 의도: "알림 누르면 노션 외부 말고 앱 내 일지 목록 / 페이지". 14.5 = 해당 mode 페이지로 이동까지만 (`cairn:focus-mode`). 14.6 = recent panel 의 발행된 페이지 row highlight. v0.5+ = 인앱 페이지 본문 lazy load + slide-in + 양방향 편집. IPC payload 는 그 시점에 `cairn:focus-page({mode, pageId})` 같이 확장 (오늘의 라우팅 패턴이 발판)

## 다음

- 14.5 머지 후 14.6 (step indicator + 카드형 결과 + settings/logs/recent panel + design polish) 진행