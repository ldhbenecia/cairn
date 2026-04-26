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
│   ├── plan.md                # 살아있는 plan (변경은 여기서)
│   ├── PROGRESS.md            # 단계별 체크리스트
│   ├── decisions/             # ADR (비자명한 결정)
│   ├── SETUP.md               # 머신별 셋업 가이드
│   ├── SECURITY.md, PROMPT.md
│   └── notes/                 # 개발 중 시행착오
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

1. `docs/PROGRESS.md` 읽고 현재 단계 파악
2. 관련 ADR(`docs/decisions/`) 확인
3. `.claude/rules/` 의 규칙 떠올리기

## 결정/진행 기록

- **비자명한 결정**: `docs/decisions/NNNN-kebab-case.md` ADR 추가 (`.claude/rules/decisions-workflow.md` 참조)
- **단계 완료 시**: `docs/PROGRESS.md` 갱신 + 커밋 (`.claude/rules/progress-update.md` 참조)

## 커밋 / PR 컨벤션

- Conventional Commits: `type(scope): subject` (subject 영어, body 한국어)
- 의미 단위로 잘게 분할 (한 PR = 한 커밋 금지)
- feature → develop는 rebase merge, develop → main은 merge commit
- PR마다 `package.json` version SemVer 따라 bump

## 살아있는 plan

전체 설계는 [docs/plan.md](docs/plan.md). 변경사항은 거기에 직접 반영.
