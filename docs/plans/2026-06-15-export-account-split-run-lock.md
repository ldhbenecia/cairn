# 2026-06-15 — 내보내기 · 계정별 요약 분리 · 동시 실행 락 UX

> 사용자 요청 3건(+ 누락 plan/progress 부채 정리)을 한 plan 으로 묶는다.
> 시퀀싱: ① 동시 실행 락 버그 → ② 계정별 요약 분리 → ③ Markdown 내보내기.

## 맥락

1. **버그**: 발행 시 "작업을 시작하지 못했어요 — Error invoking remote method 'cairn:run': Error: 이미 다른 작업이 실행 중입니다" 가 뜸. 사용자가 "내가(Claude) 뭔가 돌려서/Electron 이라 그런가" 물음.
2. **Notion 강제성 완화**: Notion 외 출력 경로가 없음. 로컬 Markdown 내보내기 + Obsidian/네이티브 메모 연동 희망.
3. **계정별 요약 분리**: GitHub 토큰을 Work·Personal 2개 등록했는데 요약이 전부 합쳐져 나옴. 계정별로 구분되면 좋겠음.

## ① 동시 실행 락 UX 버그 (선행)

### 원인 (확정)

- `running` 은 메인 프로세스 메모리의 **단일 ChildProcess 락** ([core-runner.ts:102](../../packages/desktop/src/main/core-runner.ts)). `runCore` 진입 시 non-null 이면 throw ([core-runner.ts:135](../../packages/desktop/src/main/core-runner.ts)).
- 락 트리거 3곳: 렌더러 발행([index.ts:95](../../packages/desktop/src/main/index.ts)), 자동 발행 스케줄러([auto-publish.ts:67](../../packages/desktop/src/main/auto-publish.ts)), 트레이([tray.ts:14](../../packages/desktop/src/main/tray.ts)).
- **앱 시작 시 `initAutoPublish()` 가 곧바로 백필 자동 발행을 실행**([auto-publish.ts:88](../../packages/desktop/src/main/auto-publish.ts)) → 락을 ~2분 잡음. 이게 보이지 않는 상태에서 사용자가 수동 발행을 누르면 충돌.
- **Claude(나)가 외부에서 CLI/pnpm 돌리는 것과 무관**: 이 락은 실행 중인 Electron 메인 프로세스 메모리 안에만 있음. 외부 프로세스는 건드리지 않음. 순수 앱 내부 동시 실행 가드 충돌.
- 부차: 렌더러는 자기가 띄운 run 만 `runningMode` 로 앎. 자동 발행 백필은 렌더러에 안 보임 → 충돌 시 raw IPC 에러 노출. 또 throw 메시지가 메인에 **한국어 하드코딩**이라 영어 사용자에게도 한국어가 새어나옴(i18n 위반).

### 결정

- 메인 → 모든 윈도우로 `cairn:busy`(boolean) 브로드캐스트(run set/clear 시). 자동 발행 백필 포함 **모든** 실행을 렌더러가 인지.
- 락 충돌 throw 를 **코드(`busy`)** 로 바꿔 렌더러가 i18n 매핑. 한국어 하드코딩 제거.
- 렌더러: busy 중엔 발행 트리거 비활성 + "백그라운드 작업 실행 중" 표시. 충돌해도 raw 대신 친화 문구.
- 스택 라벨: 가능하면 어떤 작업(daily/weekly/monthly)이 도는지 표시.

### 파일

- core-runner.ts (busy 브로드캐스트 helper + 코드 throw), preload (`onBusy`), App.tsx (busy state·pre-check·친화 catch), i18n (`run.busy`), 주요 발행 버튼 disable.

## ② 계정별 요약 분리 (Work / Personal)

### 현 구조

- `getGithubAccounts()` 로 계정 목록을 받아 계정별 수집 후 **`prs.push(...result.value)` 로 한 배열에 평탄화**([github-collector.service.ts:83](../../packages/core/src/github/github-collector.service.ts)) → 계정 라벨이 PR 에서 떨어져 나감. 라벨(`account.label`)은 수집 시점엔 알고 있음(line 81).

### 결정

- 각 `GithubPrSummary` 에 **계정 라벨** 부착(수집 시점에 주입). 라벨은 사용자 정의(예: "Work"/"Personal")라 egress 안전 — diff/경로/토큰 아님. (단 회사명 박지 말라고 권고; assert 는 통과)
- `get_activity` 도구 출력에 계정 그룹 정보 노출 + daily/rollup 프롬프트에 "계정별로 묶어 정리" 지침 추가(계정 ≥2 일 때만). 1개면 기존과 동일.
- 요약 본문에서 "Work / Personal" 섹션 또는 프로젝트 그룹 라벨로 구분.

### 파일

- contracts(GithubPrSummary 타입에 account 필드), github-collector(라벨 주입), summarizer tool/prompt, rollup tool/prompt, egress 테스트(라벨 허용 확인).

## ③ Markdown 로컬 내보내기 (Notion 탈종속)

### 설계 방향

- **공통 기반 = 워크로그를 로컬 Markdown 파일로 쓰기.** 사용자가 폴더를 지정 → 그 폴더가 곧:
  - **Obsidian vault** (Obsidian 은 .md 폴더일 뿐 — 별도 API 불필요)
  - 네이티브 메모 앱 import / 클립보드 복사 소스
  - Notion 없이도 굴러가는 1차 출력
- 즉 "내보내기 = 로컬 .md 출력"을 만들면 Obsidian·네이티브 메모·탈Notion 이 한 기능으로 커버됨. Obsidian 특화(frontmatter, wikilink `[[YYYY-MM-DD]]`)는 enhancement.

### 결정 (1차 범위)

- 발행 결과(또는 기존 일지)를 사용자 지정 폴더에 `YYYY-MM-DD.md` 로 쓰는 export. Notion 발행과 **병렬 출력**(택1 또는 둘 다).
- frontmatter(date/source counts) + Summary/Share/Done 구조 그대로. Obsidian 호환 위해 wikilink 옵션.
- 설정에서 export 폴더 지정 + on/off. 미지정이면 비활성.

### 열린 질문 (사용자 확인 필요)

- 범위: (a) "이 일지 .md 로 내보내기" 단발 버튼 / (b) 발행 시 폴더에 자동 동기화 / (c) Notion 대체(폴더만). → 우선 (a)+(b) 권장.
- Obsidian "연동"을 vault 폴더 출력으로 충분히 보는지, 아니면 플러그인 수준까지 원하는지.

## 시퀀싱 / 릴리스

1. ① 버그 (작은~중간 PR) — 즉시.
2. ② 계정 분리 (core + prompt) — 중간 PR.
3. ③ Markdown 내보내기 (새 표면) — 큰 PR, 사용자와 범위 확정 후.
4. 누적분(#136~#145 + 위 3건)을 모아 한 번에 minor 릴리스(v0.23.0 후보) 태깅.

## progress 부채

- 이번 세션 shipped 작업(#143 커맨드 팔레트, #144 기간별 정리, 대시보드 히트맵/시간대, 웹 리디자인+라이트박스+README+favicon, #145 워딩 중립화)에 progress 일지를 누락. `2026-06-15-session-catchup.md` 로 일괄 기록.
