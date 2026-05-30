# 2026-05-30 — packaged-fork-bundle

> 진행 단계: **단계 14 후속 fix** (packaged .app 의 fork 한계 해소) + cairn theme color + 사이즈 절반
> 상태: 완료 ✅
> 관련 일지: [2026-05-30-desktop-packaging](2026-05-30-desktop-packaging.md)

## 완료

- packaged `.app` 의 fork 실제 발행 동작 ✅
- core engine 을 single file 로 bundle (`@vercel/ncc`)
- packaged 시 cairn engine 의 logging transport X (pino-pretty/pino-roll 의 worker thread 회피)
- desktop main → core fork 시 `CAIRN_PACKAGED='true'` env 전달
- packaging arch arm64 만 (Apple Silicon, 사이즈 절반)
- cairn theme color = storm slate (#455a72 / hover #5d7390 / focus #34495e)
- preload 에 `isPackaged` 노출 (renderer 가 dev / packaged 분기 가능)

## 시행착오 / 결정

- **bundle 도구 결정 = @vercel/ncc** — 시행착오 끝에 정공법 도달
  - esbuild 시도 1: entry = src/main.ts → emitDecoratorMetadata 미지원으로 NestJS DI 실패
  - esbuild 시도 2: entry = dist/main.js (tsc 산출물) → CJS 변환 시 import.meta.url undefined → createRequire 실패
  - esbuild 시도 3: ESM bundle → 같은 module evaluation 순서 이슈
  - 결론: esbuild 자체는 TypeScript decorator metadata 비지원 + NestJS DI 와 unstable
  - **ncc 채택 이유**: TypeScript built-in + decorator metadata 자동 보존 + dynamic require 처리 + external 옵션 풍부 + 한 줄 셋업
- **cairn engine 의 packaged 분기** — `process.env.CAIRN_PACKAGED === 'true'` 시 pino transport 자체 안 만듦
  - 이유: pino-pretty / pino-roll 이 worker thread 로 transport spawn → bundle 안에서 path resolve 실패
  - 결과: packaged 시 plain JSON stdout. RunPanel 의 정규식 매칭은 JSON 안에서도 동작 (NOTION_URL_REGEX / publishKind / pageId / NO_ACTIVITY 다)
- **`import 'reflect-metadata'` 첫 줄 이동** — ESM module evaluation 순서로 다른 import 평가 전 polyfill 적용 필요
- **ncc external 모듈** — pino-pretty / pino-roll / class-validator / class-transformer / @nestjs/microservices / @nestjs/websockets / @nestjs/platform-* / cache-manager. 모두 cairn 의 standalone application 에서 안 쓰는 optional deps
- **사이즈 절반** — electron-builder.yml 의 mac arch = arm64 만 (x64 제거, 본인 머신 Apple Silicon)
- **자세히 보기 토글 = packaged 시도 유지** — 처음엔 packaged 시 hide 시도했으나 사용자 troubleshooting 불가 → revert. 일반 사용자 배포 시점 (v0.x 후반) 에 UX 결정
- **theme color = storm slate** — memory [project_cairn_theme_color](../../.claude/projects/.../memory/project_cairn_theme_color.md) 의 결정 적용. Linear lavender 그대로 X
- **cairn engine 의 logging.module.ts 변경** — IS_PACKAGED 분기 + lazy createRequire (module-level X, useFactory 안)
- **desktop preload 의 `additionalArguments`** — main 의 BrowserWindow webPreferences 가 sandbox 안 preload 로 `--cairn-packaged` flag 전달. preload 의 `process.argv.includes(...)` 로 isPackaged 결정

## 검증 결과 (사용자 실제 실행)

- `.app` 발행 동작 ✅
- packaged 시 NestJS DI 정상 (모든 modules initialized)
- collect (github / local-git / notion) → summarize → publish 단계 모두 진행
- "오늘 일지가 이미 발행됨 — skip" + pageId fallback URL 정상 표시
- step indicator + native Notification + 알림 클릭 → 앱 라우팅 모두 정상

## 알려진 별도 이슈 (이 PR 의 범위 외)

- summarizer 의 Anthropic API 호출 시점에 token 셋업 영역 — ~/.cairn/.env 의 토큰 확인 필요. fallback 동작 정상 (publish 까지 진행)

## 다음

- 본인 일상 사용 시작
- v0.2 셋업 마법사 (worklog.config + OAuth Device Flow)
- v0.5+ 인앱 노션 양방향 편집
- v0.x 후반 일반 사용자 배포 (1.0 안 시작 — memory [project_cairn_release_pattern](../../.claude/projects/.../memory/project_cairn_release_pattern.md))