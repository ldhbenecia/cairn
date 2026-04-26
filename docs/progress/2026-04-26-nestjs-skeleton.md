---
name: 2026-04-26 nestjs skeleton
description: 단계 1 첫 PR — NestJS standalone application 골격 + ConfigModule + LoggingModule + SecretsModule + Orchestrator stub
type: progress
---

# 2026-04-26 — nestjs skeleton

> 진행 단계: **1 — NestJS 스켈레톤 + GitHub 수집** (시작)
> 상태: 진행 중

## 범위

단계 1은 PR 분할 원칙(plan 35-42행)에 따라 3개 PR로 쪼갬:

1. `feature/nestjs-skeleton` ← **이 PR**
2. `feature/github-client`
3. `feature/github-collector` (단계 1 마무리, `0.2.0` minor bump)

## 완료

- NestJS 11 + `@nestjs/config` 4 + `nestjs-pino` 4 + `pino` 10 + `zod` 4 의존성
- `tsconfig.build.json` 분리, `build` / `start` / `start:dev` 스크립트 추가
- `src/config/` — zod env schema + `validateEnv` + `AppConfigService` (글로벌)
- `src/logging/` — `nestjs-pino` `LoggerModule.forRootAsync` + redact paths(`*.token`, `headers.authorization`, `env.GITHUB_TOKEN` 등)
- `src/secrets/` — `SecretsService` (env 기반, getter + `requireXxx` throw 헬퍼)
- `src/cairn/` — `RunOptions` 타입, `node:util.parseArgs` 기반 CLI 파서, `OrchestratorService` stub, `CairnModule`
- `src/main.ts` — `NestFactory.createApplicationContext` 부팅, Pino logger 등록, shutdown hooks, 실패 시 exit 1
- `.env.example` — MACHINE_NAME / NODE_ENV / LOG_LEVEL + 4 개 토큰 키만
- `pnpm typecheck` / `lint` / `build` 통과, `dist/main.js --mode=daily --dry-run` 부팅 검증

## 시행착오 / 결정

- **로깅 라이브러리**: pino 채택. `nestjs-pino`로 NestJS DI 통합 + redact paths 빌트인이 `.claude/rules/security-egress.md`와 1:1 정합. winston은 redact 직접 구현 부담.
- **barrel `index.ts` 만들지 않기로** — NestJS 공식 컨벤션 그대로 (`nest generate` 미생성). `.claude/rules/nestjs-conventions.md`에 "import / barrel" 섹션 추가.
- **`docs/progress/README.md`에 일지 한 줄씩 모으는 규칙 폐기** — 디렉토리 자체가 인덱스. README엔 진행률 표만 둠. `.claude/rules/progress-update.md` + CLAUDE.md 갱신.
- **CLI 파서**: `node:util.parseArgs` (Node 24 stable) 사용. yargs/commander 추가 의존성 회피.
- **`OrchestratorService.run()`이 `async` 안 붙은 이유**: stub 단계라 `await` 대상 없음 → `@typescript-eslint/require-await` 위반 → 인라인으로 처리. 다음 PR에서 collector 호출 추가하며 자연스럽게 `async`로 전환.
- **`@Global()` 적용 모듈**: `AppConfigModule`, `LoggingModule`, `SecretsModule` — 모든 모듈에서 import 없이 쓰이는 cross-cutting concern. NestJS 공식 docs 권장.
- **placeholder `src/index.ts` 삭제** — 단계 0에서 둔 빈 파일, `src/main.ts`로 대체됨.

## 다음

- `feature/github-client` PR — Octokit + `@octokit/plugin-throttling` + `@octokit/plugin-retry` 래퍼
- `feature/github-collector` PR — 4 search queries (KST→UTC 윈도우), `--dry-run --source=github` 검증, 단계 1 ✅ + `0.2.0`

## 다음

- `feature/github-client` PR — Octokit + `@octokit/plugin-throttling` + `@octokit/plugin-retry` 래퍼
- `feature/github-collector` PR — 4 search queries (KST→UTC 윈도우), `--dry-run --source=github` 검증, 단계 1 ✅ + `0.2.0`
