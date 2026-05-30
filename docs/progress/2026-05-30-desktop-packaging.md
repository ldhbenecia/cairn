# 2026-05-30 — desktop-packaging

> 진행 단계: **14 — v0.1 desktop 셸** (PR 14.7 — 단계 14 마지막)
> 상태: 진행 중 → 머지 시 단계 14 ✅
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)
> 직전 일지: [2026-05-30-desktop-v0.1-ux-polish](2026-05-30-desktop-v0.1-ux-polish.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.7 — electron-builder 로컬 빌드 + 본인 머신 설치 + 단계 14 ✅
  - electron-builder.yml: `extraResources` 에 `packages/core/dist` 포함 → packaged 시 `.app/Contents/Resources/core/dist/main.js` 로 진입 가능
  - core-runner: `CORE_ENTRY` / `CAIRN_ROOT` 가 `app.isPackaged` 분기
  - files.ts: `CONFIG_PATH` 도 동일 분기 (packaged 시 `~/.cairn/worklog.config.json`)
  - SETUP 메모:
    1. cairn repo root 에서 `pnpm build` (core dist 빌드 — extraResources 가 그 결과를 packaging)
    2. `pnpm desktop:dist` → `packages/desktop/dist/mac-*/cairn.app` 산출
    3. `mkdir -p ~/.cairn && cp worklog.config.json .env ~/.cairn/` (packaged app 의 cwd / config 위치)
    4. `cp -R packages/desktop/dist/mac-*/cairn.app /Applications/`
    5. Spotlight 또는 Launchpad 에서 cairn 실행 → 트레이 + 윈도우 OK
  - root v0.14.6 → **v0.15.0**, desktop v0.0.6 → **v0.1.0** (단계 14 완료 minor bump)
  - progress README 의 단계 14 row = ✅ 2026-05-30

## 시행착오 / 결정

- **packaged 시 core 위치 = `process.resourcesPath/core/dist/main.js`** — electron-builder 의 `extraResources` 가 `.app/Contents/Resources/` 에 복사. dev 시는 그대로 monorepo 의 `packages/core/dist`
- **extraResources = `core/dist` 만 포함** — 처음 시도엔 `core/node_modules` / `core/package.json` 도 포함시켰는데, pnpm 의 hoist 로 `core/node_modules` 가 symlink 트리 → electron-builder 가 따라가서 root 의 1 GB 다 복사 시도 → unpack 단계가 stuck. dist 만 포함으로 단순화
- **알려진 한계**: packaged `.app` 의 fork 시점에 cairn engine 이 `require('@nestjs/core')` 등 시도 시 module not found 가능 (deps 가 root node_modules 에 hoist 되어 packaging 안 됨). v0.2 시점에 (a) core 를 esbuild 로 single file bundle 또는 (b) core 의 deps 를 desktop 의 dependencies 로 명시 또는 (c) extraResources 의 root node_modules 선택적 포함 — 별도 ADR. **14.7 의 산출물 = packaging mechanism + UI 셸**. 실제 fork 동작은 v0.2
- **packaged 시 CAIRN_ROOT = `~/.cairn`** — `worklog.config.json` / `.env` 사용자 머신의 home 의 `.cairn` 디렉토리에서 찾음. cairn repo 와 분리. 사용자가 한 번만 셋업 (v0.2 마법사가 흡수)
- **v0.1 셸의 packaged 사용 시 셋업** — 본인 머신에 `~/.cairn/worklog.config.json` + `~/.cairn/.env` 직접 두면 발행 동작. v0.2 셋업 마법사 시점에 GUI 로 흡수
- **트레이 / 앱 brand 아이콘 = 14.7 에선 default Electron** — 본격 brand 디자인 (돌탑 모티프) 은 v0.2+ 또는 v1.0 시점. packaging mechanism 검증 + 단계 14 마무리 우선
- **launchd 자동 발화는 변경 X** — 여전히 ops/install.sh 가 등록한 plist 가 engine 직접 실행 + osascript 알림. desktop 으로 owner 이전은 v0.5+
- **v1.0 시점의 추가 작업** (roadmap 명시): 코드 서명 + notarization + 자동 업데이트 + 일반 사용자 배포 가이드

## 단계 14 회고

- 14.1 ~ 14.7 의 흐름 = packaging shell → 트레이 / 풀 윈도우 → Linear 톤 디자인 → core spawn / IPC → native Notification → UX polish → packaging
- 큰 결정: 메뉴바 popover X → 풀 윈도우 + 트레이 보조 (슬랙 패턴, 14.2 시점)
- 큰 결정: Linear DESIGN.md 의 canonical 토큰 채택 (14.3 시점)
- 큰 결정: production UX (raw stdout X, step indicator + 카드) 는 14.6 + v1.0
- 큰 결정: 노션 인앱 양방향 편집은 v0.5+ (14.6 의 Recent panel placeholder)

## 다음

- 일상 사용하면서 구체적 부족함 발견 → v0.2.x 시리즈 또는 별도 ADR
- v0.2 셋업 마법사 (worklog.config / OAuth Device Flow / Keychain)
- v0.5+ 노션 양방향 편집
- v1.0 일반 사용자 배포 (코드 서명 / 자동 업데이트)
