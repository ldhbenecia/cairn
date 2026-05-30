# 2026-05-30 — desktop-core-spawn

> 진행 단계: **14 — v0.1 desktop 셸** (PR 14.4)
> 상태: 진행 중
> 관련 plan: [docs/plans/2026-05-30-desktop-v0.1-shell.md](../plans/2026-05-30-desktop-v0.1-shell.md)
> 직전 일지: [2026-05-30-desktop-design-tokens-layout](2026-05-30-desktop-design-tokens-layout.md)

## 완료

(작성 시점 = 시작)

## 진행 중

- PR 14.4 — core spawn + IPC + 수동 trigger 실제 동작
  - main 의 `core-runner.ts` — `child_process.fork` 로 `packages/core/dist/main.js` 실행
  - IPC: `ipcMain.handle('cairn:run', { mode })`
  - preload: `window.cairn.run(mode)`
  - tray ⌘1/2/3 핸들러를 console.log → 실제 fork 호출로 교체
  - Content 의 today / week / month 페이지에 큰 trigger 버튼 + 진행 / 결과 inline 표시

## 시행착오 / 결정

- **child_process.fork 채택** (spawn + ELECTRON_RUN_AS_NODE 대안 폐기) — Electron 임베디드 node 가 fork 의 child 도 node 환경으로 실행. NestJS 의 standalone application 그대로 동작. spawn 보다 깔끔
- **CLI 인자 형식** — core 의 `cli-args.ts` 확인. `--mode=daily|weekly|monthly` + `--date=` (옵션) + `--dry-run` / `--force` / `--backfill-days` / `--lookback-days` / `--source` 멀티. 14.4 에선 `--mode` 만 사용, 나머지는 14.6 settings 에서
- **cwd = cairn repo root** — core 가 `worklog.config.json` 과 `.env` 를 cwd 에서 찾음. desktop 의 dev 시 cwd 가 packages/desktop 이라 두 단계 위 root 로 resolve. 배포 시점 (v0.2+) 에 ~/.cairn 같은 표준 위치로 옮길지는 별도 결정
- **결과 처리 = exit code + stderr 일부 + 노션 URL (가능 시)** — 14.4 의 결과 표시는 inline status (성공 / 실패 / 노션 URL 링크). stream tail / 진행률은 14.6 의 로그 viewer
- **빌드 의존** — core 의 `dist/main.js` 가 빌드되어 있어야 spawn 가능. 14.4 의 manual test 전 `pnpm build` (root) 한 번 필요. v0.2 셋업 마법사 시점에 자동 빌드 / 번들 검증
- **preload .cjs 빌드** — Electron 28+ 의 `sandbox: true` 는 ESM preload 비호환. electron-vite preload config 의 output format = cjs + entry `.cjs`. main 의 `webPreferences.preload` 도 `.cjs` 경로
- **UX 보정 1차 → 2차** — 1차 (RunPanel local state): page 전환 시 lines 잃음 + 다른 mode 페이지에서도 spinner 떠 헷갈림. 2차 (App level session map + mode 별 분리): RunLine payload 에 mode 포함, App 이 sessions[mode] 호스팅, RunPanel = props. Sidebar 의 nav item 옆에 running spinner (어느 mode 가 도는지 시각화)
- **ANSI escape codes strip** — core 의 pino-pretty 가 색 ANSI 박음. core-runner 의 emit 단계에서 `/\x1b\[[0-9;]*m/g` 정규식 strip
- **production (v1.0+) UX 는 별개** — 14.4 의 raw line tail = dev / personal v0.1 셸 한정. 일반 사용자 배포 시점엔 raw 로그 X. 단계별 step indicator ("수집 중 → 요약 중 → 발행 중") + 깔끔한 결과 박스. 이건 14.6 의 log viewer (별도 영역으로 분리) + v1.0 desktop 의 UX overhaul 시 작업

## 다음

- 14.4 머지 후 14.5 (native Notification + 노션 URL 자동 열기) 진행
