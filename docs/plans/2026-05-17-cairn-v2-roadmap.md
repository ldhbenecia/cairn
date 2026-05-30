# 2026-05-17 — cairn v2 로드맵 (engine 트랙 + desktop 트랙)

> 살아있는 plan. 단계별로 별도 plan / progress / ADR / PR 시리즈로 진행. 이 문서는 큰 방향만.

## 두 트랙

| 트랙 | 위치 | 버전 라인 |
|------|------|-----------|
| **cairn engine** | 현 repo (또는 monorepo `packages/core`) | 0.x → 1.0 → 1.x |
| **cairn desktop** | 별도 repo `cairn-desktop` 또는 monorepo `packages/desktop` | 0.x → 0.x → ... |

두 트랙은 **독립적으로 릴리스**. desktop 이 v0.3 일 때 engine 은 v0.13 일 수 있음. 의존: desktop → engine (npm link 또는 sidecar IPC).

## Engine 트랙

### 단계 9 — GitHub multi-account (이 PR / v0.10.0)

`worklog.config.json` 에 `githubAccounts: [{ label, tokenEnv }]` 추가, 단일 `GITHUB_TOKEN` 제거. 회사 + 개인 계정 동시 추적, PR summary 에 account label 노출. backward compat X (사용자 한 명, 마이그레이션 1 줄).

### 단계 10 — sleep-aware backfill (다음 PR / v0.11.0)

`RunAtLoad: true` 모든 plist 에 + cairn 에 "지난 N 일 빠진 날짜 자동 backfill" 도입. 노트북 닫고 자도 다음 열 때 일괄 채움. `pmset repeat wakeorpoweron` 은 opt-in (`ops/install.sh --with-wake`), 페어링 uninstall.

### 단계 11+ — 운영 검증 / 1.0.0 결정

며칠 ~ 몇 주 운영 → 일지 / 롤업 품질 / 알림 / 알림 noise / 비용 / 안정성 확인. OK 면 1.0.0 major bump.

### v1.x — 후속 engine 개선

- **publisher abstraction** (v1.1.0?) — Notion / Obsidian / 로컬 markdown 어댑터. `Publisher` interface 추출
- **source abstraction** (v1.2.0?) — GitLab / Bitbucket / 이슈 트래커
- **multi-Notion 깊이 개선** — 현재는 첫 worklog 워크스페이스만 발행, 다중 발행 옵션

## Desktop 트랙

### v0.1 — 셸 (foundation)

**기술 결정 (ADR 필요)**:
- **프레임워크**: Electron vs Tauri vs SwiftUI 네이티브
  - Electron: cairn engine TS 자산 그대로 재사용. 번들 ~150 MB. 가장 빠른 개발
  - Tauri: Rust 셸 + 웹뷰. 번들 ~10 MB. engine 은 Node sidecar 로 spawn
  - SwiftUI: 네이티브 macOS. 가장 가벼움. engine 과 IPC bridge 필요. 다른 OS 안 됨
- **저장소 구조**: 별도 repo vs monorepo
  - 별도: lifecycle 완전 분리. desktop 만 fork / 배포 쉬움. engine npm publish 필요
  - monorepo: cross-package PR / 같은 commit. pnpm workspace link
- **번들된 engine 실행 방식**: sidecar process spawn (`child_process.spawn(node, 'dist/main.js')`) vs in-process import

**최소 GUI**:
- 메뉴바 트레이 아이콘 (status)
- 수동 trigger 버튼 (daily / weekly / monthly)
- 로그 뷰어 (`~/.cairn/logs/cairn-*.log` tail)
- 설정 패널 (기존 `worklog.config.json` 직접 편집은 이 단계까지 유지 — 마법사는 v0.2)

### v0.2 — 셋업 마법사

`worklog.config.json` 손편집 없이 GUI 만으로 셋업 완료.

- 사용자가 "GitHub 계정 추가" 누름 → OAuth Device Flow (아래 §OAuth 참조)
- "Notion 워크스페이스 추가" 누름 → Notion OAuth + 부모 페이지 picker (`/v1/search` 로 페이지 목록)
- 로컬 repo picker (디렉토리 선택 다이얼로그)
- 검증 화면: 토큰 health check + first dry-run 결과

### v0.3 — OAuth onboarding (in-app)

**GitHub OAuth Device Flow** (가장 적합):
1. 앱 → `POST github.com/login/device/code` 으로 device code 요청
2. 사용자에게 "브라우저에서 `github.com/login/device` 열고 `XXXX-YYYY` 입력" 표시 + `shell.openExternal` 로 자동으로 브라우저 열기
3. 앱이 백그라운드에서 `POST github.com/login/oauth/access_token` 폴링 (`grant_type=urn:ietf:params:oauth:grant-type:device_code`)
4. 토큰 받음 → Keychain 저장

**OAuth App 등록 사전 작업**: GitHub Settings → Developer settings → OAuth Apps → New OAuth App. "Enable Device Flow" 체크. Client Secret 없이 PKCE / device flow 로만 동작 → 바이너리에 박혀도 안전.

**대안 검토**:
- OAuth Web Flow + `localhost:PORT` 콜백 — VS Code / GitHub Desktop 패턴. Device flow 보다 매끄럽지만 localhost server 필요. Electron 환경에서 큰 부담은 아님
- GitHub App — 토큰 1h 만료 / 재발급 / repo 단위 install. 봇 계정 같은 권한 모델. cairn 처럼 개인 PR / review 추적엔 OAuth App 이 맞음
- Git Credential Manager 위임 (`git credential.helper osxkeychain`) — git push 인증과 통합. 매력적이지만 GitHub API 는 별도 PAT 가 필요해서 cairn 의 PR / review search 에 적합하지 않음
- `gh auth token` 위임 — `gh` CLI 깔려있으면 한 줄로 끝. 개발자 타겟이면 매우 합리적. 일반 사용자 타겟이면 gh 설치 강제 어려움

**채택 (잠정)**: 일반 사용자 타겟 OAuth App + Device Flow. 개발자 타겟 별도 옵션 `gh auth token` 위임.

**Notion OAuth**: [public integration OAuth 2.0](https://developers.notion.com/docs/authorization). 같은 패턴 (`localhost:PORT` 콜백 또는 device flow 가능 시).

### v0.4 — 토큰 안전 저장 (Keychain)

`.env` 평문 파일 → OS 키체인.

- **macOS**: Keychain (`security` CLI 또는 `keytar` npm 패키지)
- **Windows / Linux**: 이미 `keytar` 가 추상화 (Credential Manager / libsecret)
- cairn engine 이 `keytar` 우선 lookup → fallback `process.env` (CLI 직접 사용자도 호환)
- desktop 앱이 OAuth 로 받은 토큰을 `keytar.setPassword('cairn', 'github-account:<label>', token)` 같은 키로 저장
- engine 의 `SecretsService.getEnv(tokenEnv)` 를 `getSecret(tokenEnv)` 로 일반화 — env / keychain 둘 다 cover

**Engine 트랙 schema 변경**: `githubAccounts[].tokenEnv` 가 단순 env 이름이 아닌 secret reference 로 진화할 수 있음. 시점은 v0.4 desktop 도입 시 engine 도 같이 minor bump.

### v0.5+ — 시간대 UI / 알림 / 사용자 정의 / 노션 양방향 / 멀티 머신 sync

- launchd plist 시각 GUI 변경 (`StartCalendarInterval` Hour 값 setter)
- `pmset wake` opt-in 토글
- 알림 권한 / 알림 빈도 / 토글
- **사용자 정의 summarizer prompt** — engine 기본 prompt 를 그대로 두되, 데스크탑 앱에서 사용자가 자기 취향대로 (한국어/영어 톤, doneBullets 형식, 카테고리, 강조점, "이력서 용도" / "회고 용도" / "팀 데일리 용도" 같은 컨텍스트) 덮어쓸 수 있게. v2 앱에선 사용자 본인 OAuth/API 크레딧을 쓰니 prompt 자유도 ↑. 토큰 사용량 추정 미리보기도 같이
- **노션 일지 / 롤업 페이지 양방향 편집** — 발행된 노션 페이지를 데스크탑 앱 안에서 열어 편집 후 노션 API 로 push back. read-only viewer X. 노션 블록 → 앱 에디터 → 노션 블록 변환 (mdast / notion-blocks 어댑터 필요). 별도 단계 plan + ADR (publisher 가 양방향이 되면 모델 변화)
- (장기) 머신 간 cairn 설정 sync — 클라우드 X 정책상 어렵지만 iCloud Drive 의 cairn 폴더 같은 사용자 자율 sync 가이드

### v1.0 — 일반 사용자 배포 가능 수준

- 셋업 마법사 완성도
- 자동 업데이트 (Electron auto-updater 또는 Tauri updater)
- 코드 서명 + notarization (macOS)
- README / SETUP 의 desktop 트랙 가이드 정식 추가

## 책임 분배

| 기능 | engine | desktop |
|------|--------|---------|
| collect / summarize / publish | ✅ | (호출만) |
| launchd 등록 | 현 `ops/install.sh` | v0.5+ 에서 GUI |
| backfill | ✅ (engine v0.11) | trigger UI 만 |
| OAuth 콜백 / 브라우저 열기 | — | ✅ |
| 토큰 발급 / Keychain 쓰기 | — | ✅ |
| 토큰 읽기 | engine 이 `getSecret` 으로 통합 | — |
| 시간대 / 옵션 UI | — | ✅ |
| status / log viewer | — | ✅ |
| publisher 추가 (Obsidian 등) | ✅ (interface + 어댑터) | UI 에서 선택만 |

## 비용·정책 가드 (유지)

- **ADR 0001** Claude Agent SDK (Anthropic API 직접 X)
- **ADR 0002** portable / 클라우드 X — 두 트랙 모두 사용자 머신에서 도는 로컬 도구. desktop 앱이 OAuth provider 와 통신하는 건 사용자 머신 ↔ provider 직접
- **ADR 0003** 코드 본문 송신 금지 — 모든 새 어댑터 추가 시 sanitize / 화이트리스트 타입 의무
- **ADR 0009** 운영자 차등 — desktop 앱이 본인 외 사용자에게 배포될 수 있다 → operator hash 정책 그대로

## 신규 ADR 후보 (마일스톤 진입 시 작성)

- `0010-electron-vs-tauri.md` — desktop 프레임워크 선택
- `0011-monorepo-vs-separate-repo.md` — 저장소 구조
- `0012-oauth-flow-choice.md` — OAuth Device Flow vs Web Flow vs GitHub App
- `0013-keychain-as-secret-store.md` — `.env` → Keychain 마이그레이션 정책
- `0014-publisher-interface.md` — publisher abstraction 모양

## 운영 메모

이 문서는 v2 마일스톤 동안 살아있음. 각 단계 진입 시:
1. 그 단계 전용 plan 추가 (`docs/plans/YYYY-MM-DD-<slug>.md`)
2. 비자명한 결정은 ADR 추가
3. 이 roadmap 의 해당 섹션을 ✅ / 변경 한 줄로 갱신
