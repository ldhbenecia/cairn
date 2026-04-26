# cairn — Claude Code 작업 컨텍스트

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

## 한 줄 요약

회사 백엔드 개발자(NestJS) 본인용 자동 작업 일지. 매일 GitHub PR/리뷰 + 로컬 Git 커밋 + Notion 편집 활동을 모아 Claude Agent SDK로 한국어 요약 → Notion 일지 페이지 발행. 주간/월간 롤업도 자동.

## 핵심 원칙 (비협상)

1. **무과금 0원**
   - Claude 호출은 반드시 `@anthropic-ai/claude-agent-sdk` 사용 (본인 Claude Max quota 안에서 동작).
   - **`@anthropic-ai/sdk` 직접 호출 금지** (별도 과금 발생).
2. **코드 본문 외부 송신 금지**
   - 외부 API로 나가는 페이로드에는 화이트리스트 메타데이터만 (PR 제목·라벨·파일명·short SHA·페이지 제목·URL).
   - diff/코드 본문/파일 내용/repo 절대경로/이메일은 타입 정의 자체에서 제외.
   - 단위 테스트로 페이로드에 `diff|patch|@@|+++|---` 키워드 없는지 스냅샷 검증.
3. **공식 docs 가장 먼저 참조**
   - NestJS: https://docs.nestjs.com (Stack Overflow나 블로그보다 우선).
   - 사용 라이브러리의 deprecated API는 작성 시점에 감지해서 사용 금지.
4. **로컬만, 클라우드 X**
   - macOS launchd만 사용. 클라우드 배포 없음.

## 디렉토리 구조 요약

```
cairn/
├── CLAUDE.md                  # 이 파일
├── .claude/rules/             # Claude가 따라야 할 세부 규칙들
├── docs/
│   ├── plans/                 # 살아있는 plan (YYYY-MM-DD-<slug>.md 누적)
│   │   └── README.md          # plan 인덱스
│   ├── progress/              # 작업 일지 (YYYY-MM-DD-<slug>.md 누적)
│   │   └── README.md          # 단계 진행률 표 (일지는 디렉토리가 인덱스)
│   ├── decisions/             # ADR (비자명한 결정)
│   ├── SETUP.md               # 머신별 셋업 가이드
│   ├── SECURITY.md, PROMPT.md
│   └── notes/                 # 짧은 메모 (일지·ADR로 옮길 정도는 아닌 것)
├── src/                       # NestJS standalone application
├── ops/                       # launchd plist + install script
└── .github/pull_request_template.md
```

## 자주 쓰는 명령어

```bash
pnpm install         # 의존성 설치 (husky 자동 활성화)
pnpm typecheck       # tsc --noEmit
pnpm lint            # ESLint
pnpm lint:fix        # ESLint --fix
pnpm format          # Prettier --write
pnpm format:check    # Prettier --check
```

## 작업 시작 전 체크

1. `docs/progress/README.md`로 현재 단계 파악, 최근 일지 한두 개 훑기
2. 관련 ADR(`docs/decisions/`) 확인
3. `.claude/rules/` 의 규칙 떠올리기

## 결정/진행 기록

- **비자명한 결정**: `docs/decisions/NNNN-kebab-case.md` ADR 추가 (`.claude/rules/decisions-workflow.md` 참조)
- **작업 시작 시**: `docs/progress/YYYY-MM-DD-<slug>.md` 일지 파일만 생성 (README는 안 건드림 — `.claude/rules/progress-update.md` 참조)
- **단계 완료 시**: 진행률 표 ✅ + version bump + main으로 PR 머지

## 커밋 / PR 컨벤션 (GitHub Flow — ADR 0006, 머지 정책 — ADR 0007)

- 모든 작업은 main에서 `feature/<slug>` (또는 `fix/`, `refactor/`, `docs/`, `chore/`) 브랜치를 파서 진행 → PR(target: main) → 머지 → 로컬 main pull. 브랜치는 머지 후에도 **삭제하지 않고 보관** (이력 추적용)
- main 직접 push 금지
- 머지 정책: **merge commit** (`git log --first-parent main` 으로 PR 단위 훑기, 세부 커밋도 보존)
- Conventional Commits: `type(scope): 한국어 주제` (subject 한국어 우선, 영어 명사구 OK; body 한국어)
- 의미 단위로 잘게 분할 (한 PR = 한 커밋 금지)
- PR마다 `package.json` version SemVer 따라 bump (ADR 0005)
- PR 제목도 Conventional Commits 형식 (`Stage 0:` 같은 형식 X)

## 살아있는 plan

큰 그림은 [docs/plans/2026-04-26-cairn-overall.md](docs/plans/2026-04-26-cairn-overall.md). plan은 `docs/plans/YYYY-MM-DD-<slug>.md`로 누적. 인덱스: [docs/plans/README.md](docs/plans/README.md).
