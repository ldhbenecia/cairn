# 2026-05-17 — monorepo 전환 (v2 desktop 트랙 진입)

> 진행 단계: **13 — monorepo 전환** ✅ (2026-05-17 완료)
> 상태: 완료

## 완료

- **ADR 0010** — Electron 채택. 본인 NestJS / TS 백엔드 배경 + 1 인 개발 + cairn engine 코드 재사용 측면에서 Tauri / SwiftUI 보다 적합. 번들 ~150 MB 는 personal 도구 맥락 수용
- **ADR 0011** — monorepo (`packages/core` + 향후 `packages/desktop`). 1 인 개발이라 cross-package 변경을 한 PR 에 묶을 수 있는 게 npm publish 사이클보다 압도적 편함
- **`pnpm-workspace.yaml`** — `packages/*`
- **`src/` → `packages/core/src/`** (git mv 로 history 유지)
- **`tsconfig.json` / `tsconfig.build.json`** → `packages/core/` (paths 그대로 — relative 기반)
- **`package.json` 분리**:
  - root `cairn-workspace@0.14.0` — workspace 메타 + dev tools (eslint / prettier / vitest / husky / commitlint / lint-staged / typescript). scripts: `pnpm -r typecheck / test / build` 위임. `pnpm start` 는 `node packages/core/dist/main.js`
  - `packages/core/package.json` — `@cairn/core@0.14.0` + 모든 runtime deps (nestjs / octokit / notion / pino / claude-agent-sdk 등)
- **`ops/com.user.cairn-*.plist.template`** — `__CAIRN_DIR__/dist/main.js` → `__CAIRN_DIR__/packages/core/dist/main.js` 셋 다 갱신
- **`docs/SETUP.md` / `docs/SETUP.ko.md` / `README.md`** — 모든 `node dist/main.js` → `node packages/core/dist/main.js` 일괄 교체
- **`logging.module.ts` 의 pino transport target** — module name 문자열 → `createRequire(import.meta.url).resolve('pino-pretty' / 'pino-roll')` 절대 경로. pnpm workspace 의 strict isolation 으로 pino worker thread 가 module name resolve 못 하는 회귀 fix
- 옛 root `dist/` + `tsconfig.tsbuildinfo` 정리 (gitignored 라 git 영향 X)
- 진행률 표 단계 13 ✅ 2026-05-17
- minor bump `0.13.0 → 0.14.0`

## 시행착오 / 결정

- **dev tools 위치 — root** — eslint / prettier / vitest / husky / commitlint / lint-staged / typescript / @types/node 모두 root devDeps. 모든 packages 공통 인프라. 각 package 가 별도 설치 안 함
- **runtime deps 위치 — `packages/core/`** — engine 실행에 필요한 모든 패키지. desktop package (v0.1+) 는 자기 deps (electron, react/svelte 등) 따로
- **`engines.node >=24` 양쪽 명시** — root + packages/core 둘 다. workspace 시작 시점에 node 버전 체크
- **base tsconfig 추출 X (현 시점)** — root 에 공통 tsconfig.base.json 두는 패턴 대신 packages/core 가 자기 tsconfig 자체 보유. 향후 desktop package 진입 시 공통 옵션 중복 보이면 그때 base 추출
- **`createRequire` 로 pino transport 절대 경로 명시** — pnpm workspace 가 pino-pretty / pino-roll 을 `packages/core/node_modules/.pnpm/.../` 하위에 설치. pino 의 worker thread 가 cwd 기준으로 `require.resolve('pino-pretty')` 실패. `import.meta.url` 기준 createRequire 로 ESM 환경에서 sync resolve → target 으로 path 전달
- **`.npmrc` 하이스트 패턴 안 씀** — createRequire fix 로 충분. 추가 hoist 는 의도하지 않은 의존성 누출 위험
- **ops plist 경로 갱신** — launchd 가 사용자 머신에 등록되어 있으면 plist 가 `__CAIRN_DIR__/dist/main.js` 를 가리키는 상태. monorepo 머지 후 사용자가 **`ops/install.sh` 재실행** 필요 (기존 plist bootout 후 새 경로로 install — 멱등). 머지 후 안내
- **SETUP docs 의 `node dist/main.js` 흔적 일괄 교체** — 안 바꾸면 새 머신 셋업 사용자가 잘못된 경로로 실행 시도. 14 라인 변경

## 다음

- **단계 14 — desktop v0.1 셸** — `packages/desktop/` 신설, Electron + TS + minimal UI (트레이 아이콘 / 수동 trigger 버튼 / 로그 뷰어). cairn engine 은 child_process spawn 으로 호출
- 본 PR 머지 후 사용자 본인 머신에서 `ops/install.sh` 재실행 (plist 갱신)
- 1.0.0 결정은 desktop 트랙과 별개로 engine 운영 검증 누적 시점에
