# cairn — 자동 작업 일지 + 누적 이력 도구

> 등산로의 돌탑처럼, 매일 작업 흔적 하나씩 쌓아 길을 남긴다.

## Context

회사 백엔드 개발자(NestJS 주력)로 일하면서 매일 한 작업이 GitHub·로컬 Git·Notion에 흩어져 있음. 평가 시즌이나 회고할 때 본인 이력을 모으려고 하면 놓치는 게 많음. 또 매일 잡일 사이에서 "오늘 뭐 했지"를 정리하는 데 맥락 전환 비용이 큼.

해결: 매일 저녁 자동으로 GitHub/로컬 Git/Notion에서 본인 활동을 수집해서 Notion 일지 페이지로 발행. 추가로 주 1회 / 월 1회 롤업 페이지도 자동 생성해서 "이력 누적"을 무인화함. 회사 워크스페이스 Slack은 봇 권한이 없어 출력 채널로 못 쓰니 입출력 모두 GitHub + 로컬 Git + Notion으로 한정.

성공 기준: (1) 매일 19:00 실행 머신에서 자동 실행되어 일지 1건 생성, (2) 매주 월요일 아침에 지난주 정리본 1건, 매월 1일 아침에 지난달 정리본 1건 생성, (3) 회사 코드 본문/diff는 외부 API에 한 바이트도 송신하지 않음, (4) 추가 과금 0원(Claude Max subscription 안에서 동작).

## 운영 환경

- 회사 GitHub·Notion·Slack 모두 회사 메일로 개인 노트북에서도 접근 가능 → 어느 머신에서나 동일하게 동작하는 **portable** 구조.
- **기본 셋업**: 개인 노트북 한 대에서 개발 + 실행 (가장 단순).
- 회사 노트북에서도 실행하고 싶을 때: 동일 레포 `git clone` → `pnpm install` → `pnpm build` → 그 머신용 `.env`/`worklog.config.json` 작성 → launchd 등록. 코드는 동일, 설정만 머신별.
- 시크릿(GitHub PAT, Notion 토큰, Anthropic 키)은 **머신마다 별도 발급해서 그 머신에만 저장**. 개인/회사 머신 간 토큰 복사 금지(키 회전 시 추적 단절).
- 두 머신에서 동시에 돌리면 멱등성 충돌 가능성 → 한 시점에 한 머신만 launchd 활성화 권장. config에 `MACHINE_NAME` 환경변수 두고 페이지 메타데이터에 어느 머신에서 발행됐는지 기록.
- **Node 24 LTS** 사용 (2026-04 시점 active LTS, EOL 2028-04). `.nvmrc`에 정확한 버전 명시 (예: `24.x` 최신 patch). Node 20은 2026-04 EOL이라 사용 금지.

## Git / PR 워크플로우

### 브랜치 전략 (GitHub Flow — ADR 0006)
- **`main`** 단일 트렁크. 직접 push 금지.
- **작업 브랜치** — `feature/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, `chore/<slug>` (prefix 풀네임). main에서 분기 → PR(target: main) → 머지 → 브랜치 삭제 → 로컬 main pull.
- **머지 정책**: **merge commit** (ADR 0007). `git log --first-parent main` 으로 PR 단위 훑기, 일반 `git log` 로 세부 커밋. rebase merge / squash 사용 X.
- **PR 단위 원칙**: 한 PR은 한 가지 일만. 리뷰 30분 안에 끝나는 크기. 단계가 크면 잘게 쪼개기 (예: 1단계 = PR 2~3개: nestjs-skeleton / github-client / github-collector).
- **단계 0의 흔적**: PR #1은 develop → main으로 진행됐음 (단계 0 종료 후 develop 폐기). 이후엔 모두 작업 브랜치 → main 패턴.

### 커밋 단위 원칙
- PR 안에서도 커밋은 **의미 단위로 잘게**. "한 PR = 한 커밋" 금지. rebase merge라 main에 그대로 들어감.
- 한 커밋 = 한 가지 변경 + 그것만으로 빌드/테스트가 깨지지 않는 상태.
- 머지 직전 `git rebase -i main`으로 fixup/reorder 정리.
- 좋은 분할 예시 (PR "feat(github): GitHub collector"):
  1. `chore(github): add octokit + plugin dependencies`
  2. `feat(github): add GithubApiClient with throttling and retry`
  3. `feat(contracts): add GithubActivity types (whitelist only)`
  4. `feat(github): add GithubCollectorService with 4 search queries`
  5. `test(github): add collector unit tests with fixtures`
  6. `docs(progress): mark stage 1 as in-progress`
- 안티패턴: `feat(github): everything for github collector` (한 줄 다목적 커밋)

### 커밋 컨벤션 (Conventional Commits)
- 형식: `type(scope): subject` (subject는 명령형 영어 또는 한국어, 50자 이내)
- **type**: `feat` | `fix` | `refactor` | `perf` | `docs` | `test` | `chore` | `build` | `ci` | `style` | `revert`
- **scope** (예시): `github`, `local-git`, `notion`, `summarizer`, `rollup`, `state`, `ops`, `docs`, `claude`, `repo`
- 예시:
  - `feat(github): add PR search collector`
  - `refactor(summarizer): extract tool definitions to tools.ts`
  - `docs(decisions): add ADR 0005 for retry strategy`
  - `chore(repo): scaffold husky + commitlint`
  - `feat(summarizer)!: switch to Claude Agent SDK` (breaking)
- **본문(body)**: WHY를 적음. WHAT은 diff가 말해줌.
- **footer**: `Refs: PROGRESS.md#5단계` / `Closes #12` / `BREAKING CHANGE: ...`
- 강제 수단: `@commitlint/cli` + `@commitlint/config-conventional` + Husky `commit-msg` 훅.

### PR template (`.github/pull_request_template.md`)
```
## Summary
<무엇을 / 왜>

## Type
- [ ] feat
- [ ] fix
- [ ] refactor / perf
- [ ] docs / chore / test / build / ci

## Related
- PROGRESS: <단계 / sub-task>
- ADR: <0001 / 0002 / ...>  (해당 시)
- Issue: #<n>  (해당 시)

## Changes
- <bullet>
- <bullet>

## Test plan
- [ ] `pnpm test` 통과
- [ ] `pnpm lint` 통과
- [ ] redaction 스냅샷 통과 (외부 송신 변경 시)
- [ ] CLI 단발 실행 검증: `node dist/main.js --mode=... --dry-run`

## Checklist
- [ ] 커밋 메시지 Conventional Commits 형식
- [ ] PROGRESS.md 갱신 (해당 단계 ✅)
- [ ] 비자명한 결정은 ADR 추가
- [ ] CLAUDE.md / docs 갱신 (해당 시)
- [ ] 시크릿/토큰 누출 없음 (`.env`, 로그 redaction 확인)
```

### 자동화 (0단계에서 완전 셋업)
- **commitlint + Husky `commit-msg`** — 형식 위반 커밋 차단
- **lint-staged + Husky `pre-commit`** — staged 파일에 `prettier --write` + `eslint --fix` 자동 적용 (커밋 시점에 자동 정리되므로 린트 일탈 자체가 불가능한 구조)
- **`pre-push` 훅** — `pnpm typecheck && pnpm lint && pnpm test --silent --bail` (느리면 test만 수동)
- **GitHub branch protection** (수동 설정): `main` 직접 푸시 금지, PR 필수
- **CHANGELOG 자동화**는 v1 밖.

### 코드 품질 도구 (0단계에서 완성, 이후 손대지 않음)
- **TypeScript**: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`. `tsconfig.build.json` 별도.
- **ESLint** (NestJS 기본 + 추가): `@typescript-eslint/recommended-type-checked`, `eslint-plugin-import`(import 정렬·순환 금지), `eslint-plugin-unused-imports`. 규칙은 NestJS 공식 starter 따르되 strict로.
- **Prettier**: `printWidth: 100`, `singleQuote: true`, `trailingComma: "all"`, `arrowParens: "always"`, `semi: true`. ESLint와 충돌 안 나게 `eslint-config-prettier` 적용.
- **`.editorconfig`**: `indent_style=space`, `indent_size=2`, `end_of_line=lf`, `charset=utf-8`, `trim_trailing_whitespace=true`, `insert_final_newline=true`.
- **`.vscode/settings.json`**: `editor.formatOnSave: true`, `editor.codeActionsOnSave: { "source.fixAll.eslint": "explicit", "source.organizeImports": "explicit" }`, `eslint.validate: ["typescript"]`. (`.vscode/`는 커밋 — 팀이 본인 한 명이라도 머신간 일관성)
- **`.vscode/extensions.json`**: ESLint, Prettier, EditorConfig 권장 확장.
- **`package.json` scripts**: `lint`(eslint), `format`(prettier --write), `format:check`(prettier --check), `typecheck`(tsc --noEmit), `test`(jest), `test:watch`. **모든 스크립트가 0 exit code로 통과한 상태에서 0단계 종료**.
- **CI 없음** (무과금) → 로컬 훅이 유일한 게이트. 그래서 훅을 우회하지 않는다 (`--no-verify` 금지, 위반 시 ADR로 사유 기록).

## NestJS 컨벤션 원칙

- **공식 docs 우선**: 명명·구조에 모호함이 있으면 https://docs.nestjs.com 의 공식 예시를 가장 먼저 참조 (Stack Overflow나 블로그보다).
- **파일명**: kebab-case + 타입 suffix. `users.controller.ts`, `users.service.ts`, `users.module.ts`, `create-user.dto.ts`, `user.entity.ts`.
- **클래스명**: PascalCase + 타입 suffix. `UsersController`, `UsersService`, `UsersModule`, `CreateUserDto`, `User` (Entity는 단수).
- **디렉토리**:
  - 리소스/도메인 모듈은 **복수형** (`users/`, `posts/`) — RESTful 컨벤션
  - 외부 시스템 어댑터·단일 책임 모듈은 시스템 이름 그대로 단수 가능 (`github/`, `notion/`, `summarizer/`)
  - 모음/컬렉션 성격은 복수 (`secrets/`, `contracts/`, `tools/`)
- **DTO**: 항상 `Dto` suffix, 동사+리소스 형태 (`CreateWorklogDto`, `UpdateRollupDto`).
- **Entity**: 단수 명사 (`Worklog`, `Rollup`).
- **Module 클래스**: 디렉토리 이름과 동일한 베이스 + `Module` (`GithubModule`, `LocalGitModule`).
- **DI**: 생성자 주입 기본, `@Injectable()` 명시, 인터페이스는 `src/contracts/` 또는 모듈 내 `*.interface.ts`.
- **standalone application**: `NestFactory.createApplicationContext`, HTTP 모듈 사용 X.
- **결정이 모호하면 ADR 작성 후 진행** — `.claude/rules/decisions-workflow.md` 참조.

## 비용 정책

- **추가 과금 0원**. 모든 외부 호출이 무료 또는 본인 기존 구독 안에서 처리.
- **Claude 호출**: `@anthropic-ai/claude-agent-sdk` 사용 → 본인 Claude Max subscription quota 내에서 동작. **Anthropic API 직접 호출(`@anthropic-ai/sdk`)은 사용 금지** (별도 과금 발생).
- README에 "이 도구를 다른 사람이 사용하려면 Claude Pro/Max subscription 필요"로 명시. 본인용이라 충분.
- GitHub PAT, Notion Internal Integration 모두 무료.
- 클라우드 배포 없음. 로컬 macOS launchd만 사용.

## 범위

### v1에 포함
- 매일 일지 자동 생성 (GitHub PR/리뷰/코멘트 + 로컬 Git 커밋 + Notion 편집 활동)
- 주간 롤업 (월요일 09:00, 지난주 일지 7개 모아 한 페이지)
- 월간 롤업 (매월 1일 09:00, 지난달 일지 모아 한 페이지)
- Claude 요약 (메타데이터만 송신)
- 멱등성 (같은 날 중복 실행해도 페이지 1개만)

### v1 밖 (future scope)
- 자동 repo discovery (`find` 기반) — v1은 명시 경로 목록만
- 회사 노트북 외 머신 동기화

## 시스템 구조

### 동작 흐름
```
launchd (실행 머신)
  ├── 매일 19:00          → main.ts --mode=daily
  ├── 매주 월 09:00       → main.ts --mode=weekly
  └── 매월 1일 09:00      → main.ts --mode=monthly
       │
       ▼
   OrchestratorService
       ├── (daily) Collectors → Summarizer → NotionPublisher (일지 DB)
       └── (weekly/monthly) RollupCollector(일지 DB 조회) → RollupSummarizer → NotionPublisher (롤업 DB)
```

### NestJS 모듈
- `AppModule` (standalone application, HTTP 없음)
- `ConfigModule`, `LoggingModule`(pino + 파일), `SecretsModule`(.env → 추후 Keychain)
- `GithubModule` — Octokit 래퍼 + Collector
- `LocalGitModule` — simple-git 래퍼 + RepoDiscovery + Collector
- `NotionModule` — `@notionhq/client` 래퍼 + Collector + Publisher
- `SummarizerModule` — **Claude Agent SDK 기반 agent harness**. 본인 Claude Max subscription quota로 호출(Anthropic API 직접 호출 X → 추가 과금 0원). 결정론적 수집기에서 만든 데이터를 도구로 노출, Claude가 호출하며 일지/롤업 작성
- `RollupModule` — 일지 DB에서 기간별 페이지 가져와 롤업 입력 생성
- `StateModule` — `~/.cairn/state.json` 멱등성
- `NotificationModule` — `osascript` 알림
- `WorklogModule` — Orchestrator + Mode 분기

### 데이터 흐름 보안
- 외부(Anthropic)로 나가는 메시지에는 화이트리스트 필드만: PR 제목·라벨·파일 경로(이름만), 커밋 메시지·short SHA, Notion 페이지 제목·URL.
- diff/코드 본문/파일 내용/repo 절대경로/이메일은 타입 정의 자체에서 제외.
- 단위 테스트로 Anthropic에 보내는 payload에 `diff|patch|@@|+++|---` 키워드 없는지 검증.

## 디렉토리 트리 (요약)

```
cairn/
├── .env.example
├── .gitignore               # .env, dist/
├── ops/
│   ├── com.user.cairn-daily.plist
│   ├── com.user.cairn-weekly.plist
│   ├── com.user.cairn-monthly.plist
│   └── install.sh
├── CLAUDE.md                      # Claude Code 작업 컨텍스트
├── README.md
├── .editorconfig
├── .gitignore
├── .nvmrc                         # Node 24 LTS (현재 active LTS) 고정
├── .vscode/
│   ├── settings.json              # formatOnSave 등
│   └── extensions.json            # ESLint/Prettier/EditorConfig 권장
├── .github/
│   └── pull_request_template.md   # PR 양식 (체크리스트 강제)
├── eslint.config.mjs              # flat config
├── .prettierrc.json
├── .prettierignore
├── commitlint.config.js
├── .husky/
│   ├── commit-msg                 # commitlint
│   ├── pre-commit                 # lint-staged
│   └── pre-push                   # typecheck + lint + test
├── .claude/
│   ├── rules/
│   │   ├── nestjs-conventions.md  # 공식 docs 우선, 명명 규칙
│   │   ├── security-egress.md     # 외부 송신 금지 + redaction 테스트 강제
│   │   ├── decisions-workflow.md  # 결정은 ADR로
│   │   └── progress-update.md     # 단계 완료 시 PROGRESS.md 갱신
│   └── skills/                    # 필요 시 추가 (add-collector 등)
├── docs/
│   ├── plans/                     # 살아있는 plan (날짜별 누적, YYYY-MM-DD-<slug>.md)
│   │   ├── README.md              # 인덱스
│   │   └── 2026-04-26-cairn-overall.md  # 이 문서
│   ├── progress/                  # 작업 일지 (날짜별 누적)
│   │   ├── README.md              # 단계 진행률 + 일지 인덱스
│   │   └── YYYY-MM-DD-<slug>.md
│   ├── SETUP.md                   # 머신별 셋업 가이드 (개인/회사 공통)
│   ├── SECURITY.md
│   ├── PROMPT.md                  # agent system prompt 본문 버전 관리
│   ├── decisions/                 # ADR
│   │   ├── 0001-use-claude-agent-sdk.md
│   │   ├── 0002-portable-deploy.md
│   │   ├── 0003-no-code-body-egress.md
│   │   ├── 0004-nestjs-conventions.md
│   │   └── ...                    # 비자명한 결정마다 추가
│   └── notes/                     # 짧은 메모 (일지·ADR로 옮길 정도는 아닌 것)
└── src/
    ├── main.ts                     # CLI 인자: --mode, --date, --dry-run, --force
    ├── app.module.ts
    ├── contracts/
    │   ├── activity.types.ts
    │   ├── collector.interface.ts
    │   └── worklog.types.ts
    ├── config/
    ├── secrets/
    ├── logging/
    ├── github/
    ├── local-git/
    ├── notion/                     # collector + publisher
    ├── summarizer/                 # daily.prompt.ts, rollup.prompt.ts
    ├── rollup/                     # weekly/monthly 입력 생성
    ├── state/
    ├── notification/
    └── cairn/
        ├── orchestrator.service.ts
        └── mode-runner.ts          # daily/weekly/monthly 분기
```

## 데이터 소스 디테일

- **GitHub**: Search API 4쿼리 (author/commenter/reviewed-by + updated/merged 필터, KST→UTC 환산). PR별로 `pulls.listFiles({per_page:100})` 1회. fine-grained PAT, repo Read-only. `@octokit/plugin-throttling` + `plugin-retry`.
- **로컬 Git**: `worklog.config.json`의 `repos: [absolute paths]` 명시 목록만 (v1). `git log --since/--until --author --no-merges`. pushed 여부는 `git branch -r --contains`. fetch 안 함.
- **Notion**: `MY_NOTION_USER_ID`로 본인 편집 페이지 필터(internal integration의 `last_edited_by`가 bot인 케이스 회피). `/v1/search` 후 클라이언트 필터링. 일지 DB·롤업 DB는 검색 결과에서 제외.

## Notion DB 구조

### 일지 DB
| 속성 | 타입 | 비고 |
|------|------|------|
| Title | title | `2026-04-26 작업 일지` |
| Date | date | 2026-04-26 |
| Tags | multi_select | `auto`, `daily` |
| Source counts | rich_text | `gh:5 / git:12 / notion:3` |
| Status | select | `draft` / `final` (final이면 자동화가 덮어쓰지 않음) |

본문: Callout(자동 생성 안내) → Summary 단락 → Done 불릿 → In Progress 불릿 → Notes 불릿 → Toggle(원본 메타데이터 JSON, 사후 감사용).

### 롤업 DB (별도)
| 속성 | 타입 | 비고 |
|------|------|------|
| Title | title | `2026-W17 주간 정리` / `2026-04 월간 정리` |
| Period | select | `weekly` / `monthly` |
| Range start | date | |
| Range end | date | |
| Tags | multi_select | `auto`, `rollup` |
| Status | select | `draft` / `final` |

본문: Highlights → Themes(Claude가 추출한 카테고리 묶음) → Metrics(PR 수/머지 수/리뷰 수/커밋 수) → 일지 페이지 링크 목록(7개 또는 30개).

## Summarizer agent harness 설계

`@anthropic-ai/claude-agent-sdk`의 tool-use loop 사용. 본인 Claude Max subscription quota 안에서 동작.

**공통 구조**
- system prompt: 한국어 일지/롤업 작성기 역할, 출력 JSON 스키마 강제, "입력에 없는 정보 추측 금지", "코드 본문 추측 금지" 규칙.
- `max_turns`: daily 5, rollup 10. 초과 시 마지막 partial 결과로 fallback.
- 각 step은 pino로 `~/.cairn/logs/`에 기록 (어떤 도구를 어떤 인자로 호출했는지 사후 감사 가능).
- agent loop 종료 신호: `submit_summary` 도구 호출. 이 도구는 결과 schema(zod)로 검증 → 실패 시 검증 오류를 다시 agent에 돌려주고 1회 재시도.

**Daily agent에 노출하는 도구**
- `list_done_items()` → 머지된 PR, push된 커밋, 완료한 리뷰 목록
- `list_in_progress_items()` → open PR, 미push 커밋, 작업 중 브랜치
- `list_notes()` → 오늘 편집한 Notion 페이지
- `get_pr_metadata(repo, number)` → 특정 PR 메타데이터 디테일 (제목, 라벨, 파일명만)
- `submit_summary({ paragraphKo, doneBullets[], inProgressBullets[], notesBullets[] })` → 종료

**Rollup agent에 노출하는 도구** (weekly/monthly)
- `list_daily_pages(rangeStart, rangeEnd)` → 기간 내 일지 페이지 메타 목록
- `get_daily_summary(date)` → 특정 일지의 Summary 단락 + 섹션 텍스트
- `list_repos_active(rangeStart, rangeEnd)` → 활동 있던 repo 목록 + 카운트
- `compute_metrics(rangeStart, rangeEnd)` → PR/머지/리뷰/커밋 수 집계 (결정론적 계산, agent가 추측하지 않게)
- `submit_rollup({ paragraphKo, themes: [{title, items[]}], highlights[], dailyPageRefs[] })` → 종료

**보안 강제**
- 모든 도구 응답 객체에 코드 본문/diff 필드 정의 자체 없음. agent가 요청해도 못 받음.
- 단위 테스트: 각 도구 응답을 JSON.stringify해서 `diff|patch|@@|^---|^\+\+\+` 정규식 매칭 없는지 스냅샷.

**모델 / 캐싱**
- 모델은 SDK 기본(Claude Max 구독 모델). `CAIRN_MODEL` env로 override 가능.
- system prompt + 도구 정의는 캐시 대상으로 표시(SDK가 지원하는 한). 일 1회 호출이라 실효 hit는 적음.

## 멱등성 & 운영

- `WorklogStateStore(~/.cairn/state.json)` 우선 가드 + Notion DB query(Date/Range 속성)로 fallback.
- `Status=final`이면 절대 덮어쓰지 않음. `--force`만 archive→재생성.
- launchd plist 3개 (daily/weekly/monthly), 각 실행은 독립 프로세스.
- 슬립 보강: daily는 19:00·23:00 두 슬롯 등록, 멱등성으로 중복 방지.
- 부분 실패: collector 단위 `Promise.allSettled`, 실패한 소스는 본문에 콜아웃으로 표기.
- 알림: `osascript -e 'display notification ...'` macOS 알림.
- 로그: `~/.cairn/logs/YYYY-MM-DD.log` (pino + pino-roll), 토큰 redact.

## 단계적 구현 순서

레포부터 0에서 시작. 각 단계의 검증은 실행할 머신에서 CLI 단발 실행으로 확인. 개발 단계는 개인 노트북 한 대에서 모두 가능. 각 단계 끝에 **PROGRESS.md 업데이트 + 결정사항이 있으면 새 ADR 추가 + 커밋**.

0. **레포 + 문서 + Claude 컨텍스트 + 품질 도구 셋업** (1~1.5일)
   - `mkdir cairn && cd cairn && git init && git branch -M main`
   - 디렉토리 트리 골격: `docs/`, `docs/decisions/`, `docs/notes/`, `src/`, `ops/`, `.claude/`, `.claude/rules/`, `.claude/skills/`, `.github/`, `.vscode/`
   - `docs/plans/2026-04-26-cairn-overall.md` ← 이 plan 파일 복사 (이후 plan 변경은 새 plan 파일 추가 또는 같은 파일 업데이트)
   - `docs/plans/README.md` 인덱스 작성
   - `docs/progress/README.md` (단계 진행률 표) + `docs/progress/2026-04-26-repo-scaffold.md` (오늘 일지)
   - `docs/decisions/` ADR 4개:
     - `0001-use-claude-agent-sdk.md` — Anthropic API 직접 호출 X, Agent SDK로 Max quota 사용
     - `0002-portable-deploy.md` — 개인/회사 머신 분리, 시크릿 정책
     - `0003-no-code-body-egress.md` — diff/코드 본문 외부 송신 금지
     - `0004-nestjs-conventions.md` — 공식 docs 준수, 파일/클래스 명명 규칙
   - `CLAUDE.md` (Claude Code가 이 레포에서 작업할 때의 컨텍스트):
     - 프로젝트 한 줄 설명 + 핵심 원칙(무과금, 무외부송신, 공식 docs 우선)
     - 디렉토리 구조 요약, 자주 쓰는 명령어
     - **"NestJS 공식 docs(https://docs.nestjs.com)를 가장 먼저 참조한다"**
     - **"파일명/클래스명/디렉토리명은 NestJS 공식 컨벤션에 맞춘다"** (아래 규칙 참조)
     - 메인 plan/PROGRESS/ADR 위치 링크
   - `.claude/rules/`:
     - `nestjs-conventions.md` — 파일·클래스·디렉토리·DTO·Entity 명명 규칙 상세
     - `security-egress.md` — 코드 본문 외부 송신 금지 + redaction 단위 테스트 강제
     - `decisions-workflow.md` — 비자명한 결정은 새 ADR 작성 후 진행
     - `progress-update.md` — 단계 완료 시 PROGRESS.md 갱신 + 커밋
   - `.claude/skills/` — 필요 시(예: `add-collector.md`, `add-tool.md`) 추후 추가
   - `README.md` 초안 (프로젝트 한 줄 + Claude Max 필요 + 셋업 링크)
   - `.gitignore` (.env, dist/, node_modules/, .DS_Store, .worklog 외)
   - **품질 도구 셋업** (이 단계에서 완전히 끝냄):
     - `pnpm init`, `pnpm add -D typescript @types/node prettier eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-config-prettier eslint-plugin-import eslint-plugin-unused-imports`
     - `pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional`
     - `tsconfig.json` (strict + noUncheckedIndexedAccess + noImplicitOverride)
     - `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.nvmrc`
     - `commitlint.config.js` (config-conventional)
     - `pnpm dlx husky init` 후 `commit-msg`/`pre-commit`/`pre-push` 훅 작성
     - `package.json` scripts: `lint`, `format`, `format:check`, `typecheck`, `test`, `test:watch`
     - `.vscode/settings.json` + `.vscode/extensions.json`
   - **커밋 분할** (의미 단위로 잘게):
     1. `chore(repo): init pnpm + typescript + .editorconfig`
     2. `chore(repo): add eslint flat config + prettier`
     3. `chore(repo): add husky + commitlint + lint-staged`
     4. `chore(repo): add vscode settings and recommended extensions`
     5. `docs(repo): add CLAUDE.md and .claude/rules`
     6. `docs(plan): add docs/plan.md and PROGRESS.md`
     7. `docs(decisions): add ADR 0001-0004`
     8. `chore(github): add PR template`
     9. `docs(repo): add README scaffold`
   - 단계 0 시점에는 develop을 만들었으나 단계 0 종료 후 폐기 → ADR 0006. 이후 모든 작업은 main에서 작업 브랜치를 파서 진행.
   - GitHub 레포 생성 후 push, branch protection(main 보호) 수동 설정.
1. **NestJS 스켈레톤 + GitHub 수집** (1~2일) — `nest new` 후 `--dry-run --source=github`, 본인 PR/리뷰/코멘트 콘솔 출력. PROGRESS.md 1단계 ✅
2. **로컬 Git 수집** (1일) — pushed/unpushed 분류, merge commit 제외 검증.
3. **Notion 수집** (0.5일) — `MY_NOTION_USER_ID` 헬퍼 CLI 포함.
4. **Notion publisher (일지)** (1일) — 같은 날 두 번 실행해도 1개만, `--force` 동작.
5. **Summarizer agent harness (daily)** (1~1.5일) — Claude Agent SDK tool-use loop, 도구 등록(아래 agent 설계 섹션 참조), payload redaction 단위 테스트.
6. **launchd daily** (0.5일) — 시간 임시 변경해 발화 확인, 와이파이 끄고 부분 실패 알림 확인.
7. **롤업 (weekly + monthly)** (1~2일) — 일지 DB query → Rollup agent harness → 롤업 DB 발행, plist 2개 추가.
8. **셋업 가이드 작성** (0.5일) — `docs/SETUP.md`: clone → install → build → 토큰 발급 → .env → plist 등록 절차. 머신마다 동일하게 적용.

## 핵심 파일 (구현 시 가장 먼저)

- [src/main.ts](cairn/src/main.ts) — CLI 인자 파싱, mode 분기, application context 부팅/종료
- [src/cairn/orchestrator.service.ts](cairn/src/cairn/orchestrator.service.ts) — 파이프라인 본체
- [src/contracts/activity.types.ts](cairn/src/contracts/activity.types.ts) — 화이트리스트 타입(보안 핵심)
- [src/github/github-collector.service.ts](cairn/src/github/github-collector.service.ts)
- [src/notion/notion-publisher.service.ts](cairn/src/notion/notion-publisher.service.ts)
- [src/summarizer/daily.agent.ts](cairn/src/summarizer/daily.agent.ts), [rollup.agent.ts](cairn/src/summarizer/rollup.agent.ts), [tools.ts](cairn/src/summarizer/tools.ts) (도구 정의)
- [docs/plan.md](cairn/docs/plan.md), [docs/PROGRESS.md](cairn/docs/PROGRESS.md), [docs/decisions/0001-use-claude-agent-sdk.md](cairn/docs/decisions/0001-use-claude-agent-sdk.md)
- [src/rollup/rollup-collector.service.ts](cairn/src/rollup/rollup-collector.service.ts)
- [ops/com.user.cairn-daily.plist](cairn/ops/com.user.cairn-daily.plist) (+ weekly/monthly)
- [docs/SETUP.md](cairn/docs/SETUP.md) — 머신별 셋업 절차

## 검증 (end-to-end)

실행할 머신(개인 또는 회사 노트북)에서:
1. `node dist/main.js --mode=daily --date=$(date +%F) --dry-run` → 콘솔에 본인 오늘 활동 JSON, redaction 단위 테스트 통과 로그.
2. `node dist/main.js --mode=daily --date=$(date +%F)` → Notion 일지 DB에 페이지 1개 생성. 다시 실행 → "skip(이미 발행)" 로그.
3. `node dist/main.js --mode=weekly --date=2026-04-20` → 그 주 일지 7개 모아 롤업 페이지 1개 생성.
4. `node dist/main.js --mode=monthly --date=2026-04-01` → 4월 일지 모아 월간 페이지 1개 생성.
5. plist 임시 시간을 `현재+2분`으로 바꿔서 launchd가 실제 발화하는지 확인. 와이파이 OFF로 부분 실패 알림 확인.
6. unit test: `pnpm test` 에서 Anthropic payload에 코드/diff 키워드 없음 스냅샷 통과.

## 외부 API 제약 메모

- GitHub Search API: 분당 30회, 결과 1000건 cap. 우리 호출 수에 여유 있음.
- Notion: 평균 3 req/s, search ~1 req/s. 클라이언트 필터링 권장.
- Anthropic: 캐시 최소 1024 토큰, 일 1회 호출이라 캐시 효과는 형식적.
