# 2026-06-04 — 배포 + 자동 업데이트 (릴리스 파이프라인)

> 데스크톱 앱을 실제 사용자에게 배포 시작. 0.x 로 시작해 점진적으로 버전을 올린다.
> 레퍼런스: [OpenUsage releases](https://github.com/robinebers/openusage/releases) — 단 OpenUsage 는 **Tauri**라 updater(서명·`latest.json`)는 다름. 참고하는 건 배포 *골격*(태그 구동, 태그↔버전 검증, 아키텍처별 산출물, GitHub Releases 호스팅, 0.x 버전)뿐. cairn 은 **Electron** 이라 자동 업데이트는 **electron-updater + GitHub provider**(Electron 표준 방식).

## 확정 결정

| 항목 | 결정 |
|------|------|
| 앱 버전 | **버전 3종(ADR 0018)** — core/desktop 은 모듈별, root(워크스페이스)는 PR 마다 +1 인 통합 버전. **앱이 표시·릴리스 기준으로 삼는 건 root**(빌드 시 `__WORKSPACE_VERSION__` 주입). desktop 모듈 버전은 electron-builder artifact 내부용 |
| 릴리스 태그 | `v<root-version>` (워크스페이스 통합 버전). CI 에서 **태그 == root version** 검증 (OpenUsage 패턴). 단 electron-builder artifact 파일명은 desktop 모듈 버전을 따름 — 릴리스 노트에 root 버전 명시 |
| 코드 서명 | **미서명** + 안내문. mac 첫 실행은 우클릭 > 열기 또는 `xattr -cr`. Apple Developer($99/yr) 없이 즉시 시작 |
| 아키텍처 | **arm64 (Apple Silicon) only** 시작. x64(Intel)는 후속 |
| 자동 업데이트 | electron-updater + GitHub provider, **check+notify 모드** (아래 제약 참조) |

### 제약: 미서명 → mac 자동 *적용* 불가

electron-updater 의 완전 자동 적용(백그라운드 다운로드 → 재시작 시 교체)은 macOS 에서 **Squirrel.Mac 이 유효한 코드 서명을 요구**한다. 미서명/ad-hoc 서명으로는 교체가 거부된다.

→ 0.x 는 **check+notify**: 새 버전을 감지하면 알림 + 릴리스 페이지를 열어 사용자가 직접 받아 재설치. 완전 자동 적용은 **코드 서명 도입 후** 후속(ADR 후보).

## 단계

### 0. i18n 콜아웃 수정 (선행, 별도 커밋)

발행 페이지에 박히는 고정 한국어 문구가 언어 설정을 안 따름. 헤딩은 이미 영어라 무관 — 콜아웃/토글 제목 5곳만.

- [notion-publisher.service.ts:283](../../packages/core/src/notion/notion-publisher.service.ts#L283) `cairn 이 자동 생성한 한국어 일지입니다.`
- [notion-publisher.service.ts:313](../../packages/core/src/notion/notion-publisher.service.ts#L313) fallback raw dump 콜아웃
- [notion-publisher.service.ts:325](../../packages/core/src/notion/notion-publisher.service.ts#L325) `원본 메타 (디버그)` 토글 제목
- [rollup-publisher.service.ts:245](../../packages/core/src/rollup/rollup-publisher.service.ts#L245) 롤업 콜아웃
- [rollup-publisher.service.ts:285](../../packages/core/src/rollup/rollup-publisher.service.ts#L285) 롤업 fallback 콜아웃

작업: publish 입력에 `lang` 전달 → 위 문구를 ko/en 분기. 헤딩처럼 영어 고정이 아니라 두 언어 다 둠(본문 언어와 일치시키기 위함).

### 1. electron-builder dist 설정 정비

- `mac.target` `dir` → **`dmg` + `zip`** (zip 은 updater 매니페스트용), arm64.
- `publish`: `{ provider: github, owner: ldhbenecia, repo: cairn }`.
- 미서명: `mac.identity: null` (서명 스킵, ad-hoc).
- 아이콘/`buildResources` 확인 (`resources/`).
- 검증: 로컬 `pnpm desktop:dist` → `dist/cairn-<ver>-arm64.dmg` + `.zip` + `latest-mac.yml` 산출 확인.

### 2. electron-updater 통합 (check+notify)

- `electron-updater` 의존성 추가.
- main 프로세스: 앱 기동 후(+선택적 주기) `autoUpdater.checkForUpdates()`. `autoDownload=false`.
- `update-available` → 네이티브 알림 + 트레이/설정에 "새 버전 vX.Y.Z — 다운로드" → 릴리스 페이지 open.
- 설정에 "업데이트 확인" 수동 트리거(선택).
- raw 엔진 로그 비노출 룰 유지 — updater 로그도 사용자 친화 문구만.

### 3. GitHub Actions — 릴리스 + CI

**`.github/workflows/release.yml`** (배포)
- 트리거: `push: tags: ['v*']`, `permissions: contents: write`.
- runner: `macos-latest` (arm64). pnpm 셋업.
- 스텝: ① 태그 형식 `^v\d+\.\d+\.\d+$` 검증 ② 태그 == root(워크스페이스) version 검증(불일치 시 fail) ③ `pnpm install` ④ core 번들 + desktop 빌드 ⑤ `electron-builder --publish always` (GITHUB_TOKEN 으로 릴리스 생성 + 자산 업로드: dmg, zip, latest-mac.yml, blockmap).

**`.github/workflows/ci.yml`** (PR/푸시 검증)
- 트리거: `pull_request` + `push` (main). `ubuntu-latest` (가볍게).
- 스텝: pnpm install → `pnpm -r typecheck` → `pnpm lint` → `pnpm -r test`.
- 지금까지 로컬 훅(husky/lint-staged)으로만 검증하던 걸 PR 단위 CI 로 승격. 외부 기여 PR 도 자동 검증.

### 4. 릴리스 노트 + README 배포 섹션

- 미서명 안내(우클릭 > 열기 / `xattr -cr /Applications/cairn.app`), 다운로드 링크, 체크섬.
- egress 룰: 자동 생성 릴리스 노트에 코드 본문/diff/절대경로 금지. 커밋 *제목*만 OK.

### 5. GitHub 커뮤니티 메타 (이슈 템플릿 + 피드백 라우팅)

사람들이 이슈를 달 수 있으니 입구를 정비.

- **`.github/ISSUE_TEMPLATE/`** ✅ (PR #54 머지) — `bug_report.yml` / `feature_request.yml` / `config.yml`. 영어 기본(한국어 OK 안내).
- **앱 피드백 탭** ([preferences-dialog.tsx:383](../../packages/desktop/src/renderer/src/components/preferences-dialog.tsx#L383)): 기존 "메일로 보내기"(`mailto:cairnlog@gmail.com`) 유지 + **"GitHub 이슈로 등록"** 버튼 추가 → `issues/new` 에 제목/본문(+앱 버전) prefill 해서 open. i18n 키 추가.
- **Preferences 레포 홍보 링크** (About/하단): GitHub 레포 링크 → `openExternal`.
- 이유: 메일은 1:1·비공개라 추적이 흩어짐. 이슈는 공개·검색·중복 병합 가능. 둘 다 제공.

### 6. 익명 텔레메트리 (PostHog, opt-out) — 배포 전 필수 (ADR 0017)

"몇 명이 쓰는지" 를 정확히 보려고 배포 전에 추가. 코드/내용 송신 0, 이벤트 카운트만.

- `posthog-node` 를 main 프로세스에. 첫 실행 시 랜덤 install UUID 생성·저장(settings) → `distinct_id`.
- 화이트리스트 이벤트만: `app_launched`, `publish`(mode, outcome). autocapture/세션레코딩 없음, IP geo 끄거나 국가 수준만.
- opt-out 토글(Preferences) + 온보딩/README 공지. 기본 켜짐.
- ingest key 는 빌드 시 주입, 없으면 graceful 비활성.
- 텔레메트리 모듈은 `trackAppLaunched`/`trackPublish` 만 노출(임의 전송 API 비노출). 페이로드 금지 키워드 단위 테스트.
- PostHog 대시보드: 고유 사용자·DAU/MAU·retention·버전 분포·발행 성공률.
- 의존: 사용자가 PostHog 계정 생성 → project API key 전달. 키 없이도 코드 선반영 가능.

### 7. 첫 릴리스 실제 수행

- root(워크스페이스) 버전 확정 → `git tag vX.Y.Z` → push → Actions → Release 확인 → 다운로드/설치/실행 검증 → 두 번째 버전으로 업데이트 알림(check+notify) 동작 확인.

## ADR 후보 / 확정

- ✅ ADR 0017 — 익명 텔레메트리(opt-out, PostHog)
- ✅ ADR 0018 — 버전 3종(core/desktop 모듈별 + root 통합), 앱 표시·릴리스 기준 = root.
- 미서명 배포 + check+notify (자동 적용 보류) — 서명 도입 시 supersede.

## 다음 (후속)

- x64(Intel) 추가, 코드 서명+공증 → 완전 자동 업데이트, Windows/Linux(필요 시).
