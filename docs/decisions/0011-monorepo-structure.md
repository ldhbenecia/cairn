# 0011. 저장소 구조 — monorepo (pnpm workspaces)

- 상태: accepted
- 작성일: 2026-05-17

## 맥락

ADR 0010 에서 v2 desktop app 을 Electron 으로 결정. 이제 engine (cairn core) 과 desktop app 코드를 어떻게 같이 보관할지 결정. 두 갈래:

- **별도 repo**: `cairn` (engine) + `cairn-desktop` (Electron app). engine 을 npm publish 후 desktop 이 dependency 로 소비
- **monorepo**: 한 repo 안 `packages/core` + `packages/desktop`. pnpm workspaces 로 link

## 결정

**monorepo** + pnpm workspaces.

구조:

```
cairn/                          # repo root
├── packages/
│   ├── core/                   # 기존 cairn engine
│   │   ├── src/
│   │   ├── dist/
│   │   ├── tsconfig.json
│   │   └── package.json        # @cairn/core
│   └── desktop/                # v0.1+ Electron app (이번 PR 에선 미생성)
│       ├── src/
│       └── package.json        # @cairn/desktop
├── ops/                        # 운영 스크립트 (root 유지)
├── docs/                       # 문서 (root 유지)
├── .env.example                # 운영 config 예시 (root 유지)
├── worklog.config.example.json # 운영 config 예시 (root 유지)
├── eslint.config.mjs           # ESLint flat config (root, 전 packages 대상)
├── .prettierrc.json
├── tsconfig.json               # base config (extend 용)
├── package.json                # workspace root
└── pnpm-workspace.yaml
```

## 대안 — 별도 repo

- 장점: lifecycle 완전 분리. desktop 만 fork / 별도 라이센스 / 별도 issue tracker 운영 가능
- 단점:
  - cross-package 변경 (예: engine 의 contract 타입 변경 → desktop 사용처 동시 갱신) 시 npm publish 사이클 거쳐야 함 — 1 인 personal 개발에서 부담
  - core 의 internal 화이트리스트 타입 (sanitize 정책 등) 을 desktop 에 노출하려면 publish 의 public API 로 박혀야 함 — 의도치 않은 stability contract 발생
  - 같은 commit 으로 묶이는 atomic 변경 불가능

## 대안 — git submodule

- 명확한 이유 없이 복잡. 한 사람이 만드는 코드 두 덩어리에 submodule 은 over-engineering

## 선택 근거

- **1 인 personal 개발** — 한 PR 에 cross-package 변경 묶을 수 있는 게 압도적으로 편함
- **engine ↔ desktop 의 결합도가 v0.x ~ v1.x 동안 빠르게 변할 예정** — desktop 이 engine 의 새 entry point (예: backfill API / status query API / config write API) 를 요구할 때 npm publish 안 거치고 같은 PR 에서 끝
- **운영 파일 (`worklog.config.json` / `.env` / `ops/`) 은 root 유지** — engine / desktop 둘 다 같은 config 를 봄. monorepo 면 root 가 자연스럽게 공유 위치
- **빌드 / 린트 / 포맷 / 테스트 도구 root 공유** — eslint / prettier / vitest / husky / commitlint / lint-staged 가 모든 packages 공통. root 의 `devDependencies` 로 한 번만 설치

## packages 명명

- `@cairn/core` — engine. NestJS standalone, daily / weekly / monthly 발행
- `@cairn/desktop` — Electron app. UI 셸 + cairn engine 호출
- 추가 packages 가능성 (예: `@cairn/cli`, `@cairn/shared-types`) 은 그 시점에 결정

## 결과

- 본 PR (단계 13) 에서 monorepo 전환:
  - `pnpm-workspace.yaml` 신설 (`packages/*`)
  - `src/` → `packages/core/src/`
  - `tsconfig.json` / `tsconfig.build.json` → `packages/core/`
  - 기존 root `package.json` 의 runtime dependencies → `packages/core/package.json`
  - root `package.json` 은 workspace 메타 + 공통 dev tools (eslint / prettier / vitest / husky / commitlint / lint-staged) 만 보유
  - `ops/com.user.cairn-*.plist.template` 의 `__CAIRN_DIR__/dist/main.js` → `__CAIRN_DIR__/packages/core/dist/main.js`
  - `ops/install.sh` 의 안내 메시지 갱신
- desktop package (`packages/desktop/`) 는 단계 14 부터 신설 — 본 PR 에선 자리만 마련

## 마이그레이션 부담

- 머지 후 launchd 등록된 사용자 (본인 머신) 는 `ops/install.sh` 재실행 필요 (plist 가 새 경로 가리키도록 갱신). install.sh 가 기존 plist bootout → 새 plist install 멱등 처리하므로 한 줄 명령

## 관련 ADR

- ADR 0010 (Electron 채택)
- ADR 0004 (NestJS 컨벤션) — `packages/core/src/` 안에서 그대로 유지
- ADR 0005 (SemVer / 단계별 minor bump) — monorepo 전환 = 단계 13 = v0.14.0
