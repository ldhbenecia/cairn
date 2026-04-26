# 2026-04-26 — repo scaffold

> 진행 단계: **0 — 레포 + 문서 + 품질 도구 셋업** ✅ (2026-04-26 완료)
> 상태: 완료

## 완료

- `git init` + main 브랜치 + 디렉토리 트리 골격 (`docs/`, `src/`, `ops/`, `.github/`, `.vscode/`, `.claude/rules/`, `.husky/`)
- commit 1 — `chore(repo): pnpm + TypeScript + .editorconfig`
- commit 2 — `chore(repo): ESLint flat config + Prettier`
- commit 3 — `chore(repo): Husky + commitlint + lint-staged` (commit-msg/pre-commit/pre-push 작동 검증 완료)
- commit 4 — `chore(repo): VSCode settings + recommended extensions`
- commit 5 — `docs(repo): CLAUDE.md and .claude/rules` (rules 4개)

## 추가 완료 (commit 6 이후)

- commit 6 — `docs(plan): living plan + progress 일지 누적 구조` (PROGRESS.md → docs/progress/, plan.md → docs/plans/)
- commit 7 — `docs(decisions): 핵심 정책 5종 ADR 정리 (0001-0005)`
- commit 8 — `chore(github): PR template 추가`
- commit 9 — `docs(repo): README scaffold`
- `develop` 브랜치 생성 (main에서 분기)
- 단계 0 마무리 commit (progress 갱신 + version 0.1.0 bump)
- main으로 merge (develop → main은 merge commit)
- GitHub public 레포 생성 + push (이 파일 포함)

## 시행착오 / 결정

- **모듈 시스템**: NestJS 공식 starter가 `module: NodeNext` 권장 (CommonJS 기본, package.json `"type": "module"` 안 적음). 그대로 따름.
- **typescript-eslint v8 헬퍼 deprecated**: `tseslint.config()` → 단순 배열 export로 교체. 사소한 패턴이라 ADR 안 적고 메모만.
- **VSCode `typescript.tsdk` deprecated**: 옵션 자체 제거 (워크스페이스 TS 사용은 기본 동작).
- **VSCode `eslint.useFlatConfig` 불필요**: ESLint 확장 v3+가 자동 감지.
- **PROGRESS 구조 변경**: 단일 `docs/PROGRESS.md` → `docs/progress/YYYY-MM-DD-<slug>.md` 누적 + `README.md` 인덱스. 사용자 피드백.
- **Node 버전**: `.nvmrc`에 `v24.15.0` (현재 active LTS) 고정. 머신은 `nvm install --lts`로 업그레이드.

## 다음 (단계 1로)

- NestJS 의존성 + standalone application 베이스 (`createApplicationContext`)
- CLI 인자 파싱 (`--mode`, `--date`, `--dry-run`, `--source`, `--force`)
- ConfigModule + .env 로딩, LoggingModule, SecretsModule
- GithubModule: GithubApiClient (Octokit + throttling/retry)
- GithubCollectorService: 4 search queries (KST→UTC 윈도우)
- 검증: `node dist/main.js --date=$(date +%F) --dry-run --source=github`
- 단계 1 완료 시 `0.1.0` → `0.2.0`
