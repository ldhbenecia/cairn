# 셋업 가이드

새 macOS 머신에 cairn 을 설치/실행하는 절차. cairn 은 본인용 도구라 머신마다 자체 시크릿 / 설정을 둔다.

> **English guide**: [SETUP.md](SETUP.md)

> **대부분은 데스크톱 앱을 쓰면 된다.** [cairn 데스크톱 앱](../README.md)은 첫 실행 마법사가 Notion + GitHub 연결(있으면 `gh` CLI 로그인 재사용)하고 `.env` + `worklog.config.json` 을 대신 만들어 주며, 자동 발행 스케줄도 앱이 직접 관리한다. 이 가이드는 **수동 / 헤드리스 / CLI-only** 경로 — GUI 없는 서버나 `launchd` 자동화용. 크로스기기 통계 동기화는 데스크톱 앱 기능(앱에서 구글 로그인)이라 이 CLI 흐름엔 포함되지 않는다.

## 1. 사전 조건

- **macOS** — 헤드리스 `launchd` 스케줄(§9)에만 필요. 데스크톱 앱은 스케줄을 자체 관리
- **Node 24 LTS** — [.nvmrc](../.nvmrc) 따름. `nvm` / `volta` / `homebrew` 어느 것이든
- **pnpm 10+** — `npm install -g pnpm`
- **Claude Pro / Max 구독** — cairn 은 Claude Agent SDK 호출 시 로컬 Claude Code 의 OAuth 자격을 그대로 상속. 별도 Anthropic API 키 불필요 (Claude Code 에 로그인되어 있으면 됨)
- **Notion 계정** — internal integration 만들 수 있는 워크스페이스 1개
- **GitHub 계정** — 추적하고 싶은 PR / 리뷰가 있는 곳

## 2. clone + 설치

```bash
git clone https://github.com/<owner>/cairn.git
cd cairn
nvm use            # .nvmrc 따름
pnpm install
pnpm build
```

`pnpm build` → `@cairn/core` 가 `packages/core/dist/main.js` 로 빌드됨. CLI 와 launchd job 둘 다 이걸 진입점으로 씀.

## 3. Notion integration

cairn 은 integration 한 개당 하나의 워크스페이스만 씀. daily 일지 DB 와 rollup DB 는 같은 부모 페이지 안에 자동으로 생성된다 (첫 실행 때).

### 3.1 Internal integration 생성

1. <https://www.notion.so/profile/integrations> → **New integration**
2. 이름 (e.g. `cairn-personal`) + 발행할 워크스페이스 선택
3. 권한 (Capabilities): **Read content**, **Update content**, **Insert content** 셋 다 활성화
4. 저장 후 **Internal Integration Secret** 복사 (`ntn_…` 로 시작)

### 3.2 부모 페이지 생성

1. 같은 워크스페이스에 일반 페이지 하나 만들기 (e.g. `cairn` / `Worklog`)
2. 페이지 메뉴 → **Connections** → **Add connections** → 위에서 만든 integration 선택. integration 이 이 페이지를 read/write 할 수 있어야 함
3. 페이지 URL 복사. URL 끝의 32자 hex 가 page ID. UUID 형식 (`8-4-4-4-12`) 으로 dash 추가:
   ```
   https://notion.so/My-cairn-aabbccddeeff00112233445566778899
   →  pageId = aabbccdd-eeff-0011-2233-445566778899
   ```

### 3.3 Notion myUserId 조회

본인이 편집한 노션 페이지만 골라내려고 user ID 가 필요.

```bash
curl -sS https://api.notion.com/v1/users/me \
  -H "Authorization: Bearer ntn_여기에_토큰" \
  -H "Notion-Version: 2022-06-28" \
  | jq -r '.id'
```

반환된 UUID 가 `myUserId`.

## 4. GitHub fine-grained PAT (계정마다 한 개)

cairn 은 여러 GitHub 계정 (예: 개인 + 회사) 동시 추적 지원. 추적할 **각 계정마다** PAT 발급:

1. <https://github.com/settings/personal-access-tokens/new> (해당 계정으로 로그인 상태에서)
2. **Resource owner**: 본인 (또는 org PR 까지 추적하려면 org)
3. **Repository access**: 추적할 repo 만 선택
4. **Permissions** (Repository): `Pull requests: Read-only`, `Contents: Read-only`, `Metadata: Read-only`
5. 생성 후 토큰 복사 (`github_pat_…`)

cairn 은 GitHub 에 쓰지 않는다. 읽기 전용으로 충분.

각 토큰은 `.env` 의 별도 env 변수에 저장 (§6) → `worklog.config.json` 의 `githubAccounts[].tokenEnv` 가 참조 (§7).

## 5. 로컬 Git repo

추적할 각 로컬 repo 의 절대경로를 모은다. 그 repo 의 `git config user.email` 이 본인 커밋 작성자 email 과 일치해야 함:

```bash
cd /path/to/repo
git config user.email
```

cairn 은 이 email 로 본인이 작성한 commit 만 골라낸다.

## 6. `.env`

```bash
cp .env.example .env
```

```env
MACHINE_NAME=personal-mac
NODE_ENV=development
LOG_LEVEL=info
# MACHINE_NAME 은 이 머신 라벨, NODE_ENV=production 이면 네이티브 알림 활성화
# (launchd plist 가 셋팅함), LOG_LEVEL 은 pino 레벨. 셋 다 기본값 있음

ANTHROPIC_OAUTH_TOKEN=
# 비워둬도 OK — Claude Code 로그인 상태면 OAuth 자동 상속

GITHUB_TOKEN_PERSONAL=github_pat_...
GITHUB_TOKEN_WORK=github_pat_...
# githubAccounts[].tokenEnv 가 가리키는 env 이름마다 한 줄씩 (이름 자유)

NOTION_TOKEN_PERSONAL=ntn_...
NOTION_TOKEN_WORK=ntn_...
# notionWorkspaces[].tokenEnv 가 가리키는 env 이름마다 한 줄씩

CAIRN_CONFIG_PATH=
# 선택. worklog.config.json 경로 override (기본값 ./worklog.config.json)
```

`.env` 는 gitignore 됨. 그 상태로 유지.

## 7. `worklog.config.json`

repo 루트에 `worklog.config.json` 을 만들고 다음을 채운다:

```json
{
  "localGitRepos": ["/Users/me/code/repo-1", "/Users/me/code/repo-2"],
  "githubAccounts": [
    { "label": "personal", "tokenEnv": "GITHUB_TOKEN_PERSONAL" },
    { "label": "work", "tokenEnv": "GITHUB_TOKEN_WORK" }
  ],
  "notionWorkspaces": [
    {
      "label": "personal",
      "tokenEnv": "NOTION_TOKEN_PERSONAL",
      "myUserId": "<본인 notion user id>",
      "worklog": { "pageId": "<§3.2 부모 페이지 id>" }
    }
  ]
}
```

`githubAccounts` 는 자유 array — 본인이 추적할 GitHub 계정 수만큼 항목 추가. `label` 은 본인이 정하는 사람용 이름 (`personal` / `work` / `oss` / `회사명` 등 자유) — cairn 이 PR 요약에 그대로 노출함. `tokenEnv` 는 `.env` 에 박은 환경변수 이름 — 컨벤션은 `GITHUB_TOKEN_<UPPER_LABEL>` 이지만 `.env` 와 이 파일이 같은 이름을 가리키기만 하면 됨. array 를 비워두거나 생략하면 GitHub 추적 0개.

`worklog.pageId` 만 박으면 됨. 첫 실행 때 cairn 이 그 페이지 안에 두 개의 인라인 DB 를 자동 생성:

- `Daily Worklog (cairn)` — daily 일지 DB
- `Rollup (cairn)` — 주간/월간 롤업 DB (첫 weekly/monthly 실행 시)

생성 후 `databaseId` / `dataSourceId` 가 `worklog.config.json` 에 자동 저장된다. 롤업 DB 를 다른 페이지에 두고 싶으면 별도 `rollup.pageId` 명시 — 안 적으면 worklog 와 같은 부모 페이지를 씀.

`worklog.config.json` 도 gitignore 됨.

## 8. 첫 실행

### 8.1 dry-run (노션에 안 씀)

```bash
node packages/core/dist/main.js --mode=daily --date=$(date +%F) --dry-run
```

GitHub / local-git / Notion 활동 데이터가 JSON 으로 stdout 에 떨어진다.

### 8.2 실제 daily 발행

```bash
node packages/core/dist/main.js --mode=daily --date=$(date +%F)
```

성공 시:

- 부모 페이지 안에 `Daily Worklog (cairn)` 인라인 DB 가 새로 생김
- 그 DB 안에 `<date> 작업 일지` 페이지 1개 발행
- `worklog.config.json` 의 `worklog` 에 `databaseId` / `dataSourceId` 자동 저장됨
- macOS 알림 `cairn 일지 — <date> 발행 (gh:N / git:N / notion:N)`

### 8.3 멱등성 검증

같은 날짜로 재실행 → `worklog page already exists — skip (use --force to recreate)` 로그 + skip 알림. `--force` 로 archive 후 재생성.

### 8.4 첫 주간/월간 롤업

해당 주/달에 daily 페이지가 1개 이상 있어야 롤업이 돈다:

```bash
node packages/core/dist/main.js --mode=weekly --date=$(date +%F)
node packages/core/dist/main.js --mode=monthly --date=$(date +%F)
```

첫 실행 시 롤업 DB 자동 생성. weekly 제목: `2026-W19 주간 정리`. monthly: `2026-05 월간 정리`.

## 9. launchd 등록

> **데스크톱 앱 사용자는 이 섹션 건너뛰어도 됨.** 자동 발행은 데스크톱 앱이 사용자가 정한 로컬 시각에 맡아 처리한다 (ADR 0015). `launchd` 는 GUI 없는 환경용으로 남겨둔 deprecated 헤드리스 / CLI-only 스케줄러.

세 plist (daily / weekly / monthly) 모두 일괄 등록:

```bash
ops/install.sh
```

스크립트가 하는 일:

- 각 `ops/com.user.cairn-{daily,weekly,monthly}.plist.template` 읽음
- placeholder (`__NODE_PATH__` / `__CAIRN_DIR__` / `__USER_HOME__`) 치환
- `~/Library/LaunchAgents/` 에 배치
- `launchctl bootstrap gui/$UID` 로 등록

확인:

```bash
launchctl list | grep cairn
```

기본 스케줄 (시스템 TZ 기준):

| Job | 스케줄 |
|-----|--------|
| daily | 매일 19:00 + 23:00, **+ RunAtLoad** |
| weekly | 매주 월요일 07:00 + 11:00, **+ RunAtLoad** |
| monthly | 매월 2일 07:00 + 11:00, **+ RunAtLoad** |

두 시각 슬롯 외에 `RunAtLoad: true` 로 사용자 로그인 / 세션 시작 시 1회 더 발화. daily 모드는 명시적 `--date` 가 없으면 지난 7 일 (default) 중 빠진 날짜를 자동 backfill — 노트북 닫고 자다가 다음 날 열면 누락분 일괄 발행.

### 선택: 새벽 슬롯도 깨우려면 (`--with-wake`)

lid 닫고 자도 03:00 슬롯이 발화하길 원하면:

```bash
ops/install.sh --with-wake
```

`sudo pmset repeat wakeorpoweron MTWRFSU 02:55:00` 등록 → Mac 이 매일 02:55 잠시 깸 → 03:00 launchd 슬롯 fire → 다시 sleep. sentinel 파일 `~/.cairn/pmset-installed-by-cairn` 으로 cairn 이 박은 것임을 표시, `--uninstall` 시 cleanup.

주의:
- `pmset repeat` 는 시스템 전역 **1개 슬롯만 지원** — 다른 도구의 wake 스케줄을 덮어씀
- `sudo` 필요
- lid 닫힘 + 배터리만 일 땐 macOS / Apple Silicon firmware 에 따라 wake 안 될 수 있음. 충전기 꽂아두는 편이 안전

평소 노트북-only 운영이면 RunAtLoad + daily backfill 조합으로 충분. `--with-wake` 는 시각 정확도가 중요한 사용자용.

### 해제

```bash
ops/install.sh --uninstall
```

세 plist 해제 + `--with-wake` 로 박았던 pmset 도 sentinel 확인 후 자동 해제.

## 10. 로그 / 알림

- 실행 단위 pino 로그: `~/.cairn/logs/cairn-YYYY-MM-DD.log` (`pino-roll` 로 일자별 회전)
- launchd stdout / stderr: `~/.cairn/logs/launchd.{out,err}.log`, `launchd-weekly.{...}`, `launchd-monthly.{...}`
- macOS 알림은 `NODE_ENV=production` 일 때만 발화 (launchd plist 가 셋팅함). 터미널에서 직접 호출 시엔 알림 안 뜸 — 개발 iteration 에 noise 안 만들려는 의도

## 11. 다중 머신 셋업

cairn 은 여러 머신 (회사 노트북 + 집 노트북 등) 운영을 가정. 새 머신마다:

1. §2 반복 (clone, install, build)
2. §6 반복 (`.env`) — `.env` 자체는 머신 간 동기화 X
3. §7 반복 (`worklog.config.json`) — 로컬 repo 절대경로만 머신마다 다르고, Notion / GitHub 식별자는 공통
4. §9 반복 (`ops/install.sh`)

같은 날짜에 두 머신이 동시에 발행해도 멱등성으로 안전.

## 12. 트러블슈팅

### 롤업 / 일지 DB 가 노션에 안 만들어짐

DB 는 첫 publish 때 lazy 로 생성된다 (config 로드 시 X). `--mode=weekly` 가 `no daily pages in range — skipping summarizer + publisher` 로 떨어지면 publish 자체가 안 됨 → DB 도 안 생김. 일지가 1개 이상 들어있는 주/달 날짜로 다시 실행.

### `no notionWorkspace with worklog.pageId`

`worklog.config.json` 에 `worklog.pageId` 가 없거나, 해당 `tokenEnv` (e.g. `NOTION_TOKEN_PERSONAL`) 가 `.env` 에서 비어있음.

### Notion API 401 / 404 (첫 실행 시)

부모 페이지에 integration 이 share 되었는지 확인 (§3.2 step 2). 명시적으로 추가하지 않은 페이지는 integration 이 못 본다.

### macOS 알림이 안 뜸

- `NODE_ENV=production` 일 때만 알림. 터미널 수동 실행은 의도적으로 silent
- launchd 발화 알림: 시스템 설정 → 알림 → Script Editor → 알림 허용 (osascript 알림은 Script Editor 권한 사용)

### launchd 가 발화 안 함 / 어느 날 빠짐

- `StartCalendarInterval` 은 absolute 시간이라 sleep 중인 슬롯은 그냥 놓침. 그래서 각 job 에 두 슬롯 + `RunAtLoad: true` (로그인 / 세션 시작 시) 셋팅
- 강제 발화로 검증: `launchctl kickstart -k gui/$UID/com.user.cairn-daily`
- 로그 확인: `tail -f ~/.cairn/logs/launchd.err.log`
- **빠진 날짜는 자동 backfill** — daily 모드가 명시적 `--date` 없이 돌면 worklog DB 를 query 해서 지난 `--backfill-days` (default 7) 중 발행 안 된 날짜를 chronological 순서로 일괄 발행. RunAtLoad 덕분에 다음 노트북 열면 자동으로 처리됨. 알림은 한 개로 묶임
- 한 번에 backfill 끄려면: `--backfill-days=0`. 특정 날짜만 노리려면 `--date=YYYY-MM-DD` (이 경우 backfill 도 자동 끔)
- lid 닫고 자도 시각 정확하게 발화하길 원하면 `ops/install.sh --with-wake` (위 §9 참조)

### cost 추적 callout 이 `$0.00` 이거나 안 보임

cost callout 은 운영자 (`CAIRN_OPERATOR_SECRET` env 가 source 에 박힌 hash 와 일치) 에게만 노출. fork / 외부 사용자에겐 callout 없음 — 의도된 동작 ([ADR 0009](decisions/0009-summarizer-auth-and-sanitize.md))
