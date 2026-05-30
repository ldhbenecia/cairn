# 2026-05-30 — desktop-design-tokens-layout

> 진행 단계: **14 — v0.1 desktop 셸** (PR 14.3)
> 상태: 진행 중
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)
> 직전 일지: [2026-05-30-desktop-tray-menu](2026-05-30-desktop-tray-menu.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.3 — 디자인 토큰 + Linear 톤 + 메인 레이아웃 골조
  - styles.css 의 `@theme` 토큰 정교화 (Linear / Framer / Apple 톤 추정)
  - TitleBar (drag region + 앱 타이틀) + Sidebar (nav) + Content (panel placeholder) 레이아웃
  - lucide-react 아이콘으로 sidebar nav
  - 빈 panel 이지만 디자인 결 확인 가능

## 시행착오 / 결정

- **트레이 brand 아이콘은 14.3 에서 제외** — 텍스트 트레이 ('cairn') 유지. 본격 PNG / template 아이콘은 사용자 디자인 파일 받으면 별도로 (또는 14.7 전). 이유: SVG → PNG export 가 워크플로 부담 (sips / ImageMagick / Figma 거쳐야), 디자인 자체도 cairn brand (돌탑 모티프) 의 시안 필요
- **Linear 톤 토큰 값** — 추정값으로 시작했다가 사용자 지적으로 `npx getdesign@latest add linear.app` 을 `/tmp/getdesign-linear/` 에서 실행 → DESIGN.md (548 줄) 확보 → 추정값 폐기 후 Linear 의 실제 canonical 토큰 적용:
  - canvas #010102 (faint blue tint) + surface ladder #0f1011 / #141516 / #18191a / #191a1b
  - hairline #23252a (1px border) / #34343a (strong) / #3e3e44 (tertiary)
  - ink #f7f8f8 / muted #d0d6e0 / subtle #8a8f98 / tertiary #62666d
  - accent lavender-blue #5e6ad2 (cairn brand 색은 우선 Linear 의 lavender 그대로. 추후 stone/amber 로 변경 가능)
  - radius 4/6/8/12/16/24 (xs/sm/md/lg/xl/2xl)
  - typography body 14px line-height 1.5 letter-spacing 0
  - 출처: `npx getdesign@latest add linear.app` 의 산출물 (Linear 의 marketing DESIGN.md)
- **상단 TitleBar 제거** — sidebar 위쪽 빈 영역이 traffic light + drag region 흡수. sidebar 의 상단 placeholder = traffic light 자리. Linear / Slack 패턴
- **헤더 영역 = h-14 (56px)** — 처음 h-11 (44px) 으로 시도했으나 traffic light 와 sidebar 첫 항목 사이 간격 부족. Linear top-nav 스펙 (56px) 따라 h-14 로. 양쪽 (sidebar / content) 동일
- **trafficLightPosition y: 20** — h-14 헤더 안에서 traffic light 가 시각적 가운데 (56-14)/2 ≈ 21 → 20
- **레이아웃 = TitleBar + Sidebar + Content** — Linear / Slack / ChatGPT 표준. 14.6 에서 Content 의 각 panel (status / 수동 trigger / 로그 / 최근 노션) 채움
- **Sidebar nav 항목** — 오늘 / 주 / 월 / 최근 노션 / 로그 / 설정. 14.3 에선 active state + hover 만, 실제 라우팅은 14.6 에서

## 다음

- 14.3 머지 후 14.4 (core spawn + IPC + 수동 trigger) 진행
- 트레이 brand 아이콘은 별도 PR 또는 디자인 파일 도착 시점에
