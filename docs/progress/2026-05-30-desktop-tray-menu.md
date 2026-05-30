# 2026-05-30 — desktop-tray-menu

> 진행 단계: **14 — v0.1 desktop 셸** (PR 14.2)
> 상태: 진행 중
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)
> 직전 일지: [2026-05-30-desktop-scaffold](2026-05-30-desktop-scaffold.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.2 — 트레이 아이콘 + 메뉴 + 작은 윈도우 토글
  - `src/main/tray.ts` 분리 — Tray + Menu + 윈도우 토글 로직
  - 메뉴 항목 7 개 (오늘 / 주 / 월 / 분리 / 로그 폴더 / 최근 노션 / 분리 / Quit) — 핸들러는 일단 log 만, 실제 동작은 14.4 (core spawn) / 14.5 (알림) / 14.6 (최근 노션) 부터
  - 트레이 클릭 시 윈도우 anchor 아래 toggle
  - 윈도우는 부팅 시 hide, 트레이 클릭 시 show

## 시행착오 / 결정

- **트레이 아이콘 = macOS 텍스트 트레이 (nativeImage.createEmpty + setTitle('cairn'))** — 14.2 에선 진짜 아이콘 디자인 없이 텍스트만. 14.3 (Linear 톤 디자인 토큰 + 아이콘 본격) 에서 cairn brand 아이콘 PNG / template 으로 교체.
  - 이유: 임시 placeholder PNG 만들기보다 14.3 의 디자인 작업과 같이 가는 게 의미 단위 명확
  - 단점: Linux / Windows 에선 아이콘 없으면 안 보일 수 있음. v0.1 셸은 macOS 본인 머신 기준 (ADR 0010) 이라 허용
- **윈도우 토글 패턴** — 트레이 메뉴바 anchor 좌표 → 그 아래에 윈도우 (Linear / Slack / ChatGPT 등 메뉴바 앱 표준 패턴)
- **showDockIcon = false** — 메뉴바 전용 앱이라 Dock 아이콘 숨김 (app.dock.hide()) → 트레이만 cairn 진입점
- **윈도우 사이즈 360x640 (9:16 직사각형)** — 14.1 에선 잠정 380x540 (~1:1.4) 였으나 노션 페이지가 길어 직사각형 비율이 더 자연스러움. v0.5+ 노션 페이지 양방향 편집까지 시야에 두고 세로로 긴 비율 선택
- **plan / roadmap 갱신 — 노션 DB 양방향 편집 (v0.5+ 후보)** — 발행된 노션 페이지를 데스크탑 앱 안에서 편집 후 노션 API 로 push back. v0.1 셸 범위 밖이지만 사이즈 / 레이아웃 결정에 영향을 줘서 14.2 의 결정 컨텍스트로 메모

## 다음

- 14.2 머지 후 14.3 (디자인 토큰 + Linear 톤 적용 + 트레이 아이콘 PNG) 진행
