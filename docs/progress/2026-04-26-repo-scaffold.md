# 2026-04-26 — repo scaffold

> 진행 단계: **0 — 레포 + 문서 + 품질 도구 셋업** (시작)
> 상태: 진행 중

## 완료

- `git init` + main 브랜치 + 디렉토리 트리 골격 (`docs/`, `src/`, `ops/`, `.github/`, `.vscode/`, `.claude/rules/`, `.husky/`)
- commit 1 — `chore(repo): pnpm + TypeScript + .editorconfig`
- commit 2 — `chore(repo): ESLint flat config + Prettier`
- commit 3 — `chore(repo): Husky + commitlint + lint-staged` (commit-msg/pre-commit/pre-push 작동 검증 완료)
- commit 4 — `chore(repo): VSCode settings + recommended extensions`
- commit 5 — `docs(repo): CLAUDE.md and .claude/rules` (rules 4개)

## 진행 중

- commit 6 — `docs(plan): docs/plan.md and docs/progress/` (이 파일 포함)

## 시행착오 / 결정

- **모듈 시스템**: NestJS 공식 starter가 `module: NodeNext` 권장 (CommonJS 기본, package.json `"type": "module"` 안 적음). 그대로 따름.
- **typescript-eslint v8 헬퍼 deprecated**: `tseslint.config()` → 단순 배열 export로 교체. 사소한 패턴이라 ADR 안 적고 메모만.
- **VSCode `typescript.tsdk` deprecated**: 옵션 자체 제거 (워크스페이스 TS 사용은 기본 동작).
- **VSCode `eslint.useFlatConfig` 불필요**: ESLint 확장 v3+가 자동 감지.
- **PROGRESS 구조 변경**: 단일 `docs/PROGRESS.md` → `docs/progress/YYYY-MM-DD-<slug>.md` 누적 + `README.md` 인덱스. 사용자 피드백.
- **Node 버전**: `.nvmrc`에 `v24.15.0` (현재 active LTS) 고정. 머신은 `nvm install --lts`로 업그레이드.

## 다음

- commit 6 (이 일지를 포함하는 plan/progress 셋업)
- commit 7 — ADR 0001-0005 작성
- commit 8 — `.github/pull_request_template.md`
- commit 9 — README scaffold (다른 사람이 레포만 보고도 이해 가능하게 풍부하게)
- develop 브랜치 생성
- (선택) GitHub 레포 생성 + push + branch protection
- 단계 0 완료 시 `package.json` version `0.0.0` → `0.1.0`
