# 2026-06-19 — modal-redesign-release

> 진행 단계: 데스크톱 비주얼 라운드 + 발행 플로우 버그 (마무리)
> 상태: 완료 (v0.23.1 릴리스)

v0.23.0 이후 누적분(#153~#160)을 묶어 정리. 사용자 화면 피드백 기반의 UI 재디자인·라이트 테마 정비·발행 버그 수정.

## 완료 (머지됨)
- **#153 UX 폴리시** — 드로어 오버플로 메뉴·평문 URL 링크화·export 폴더 등록 해제·모델 카드 애니메이션.
- **#154 docs 부채** — ADR 0023~0025 + progress 일괄.
- **#155 Done 계정 서브헤딩 + 빈 Notes/InProgress 생략** (core 0.20.1).
- **#156~#159 라이트 테마 정비** — 포커스 링 통일·팔레트(Linear 톤)·글래스 투명도·알림 권한 UX·커스텀 캘린더 date picker(월 이동·연·월 점프 픽스 포함).
- **#157 임의 날짜/주/달 발행** — core `--date` 재사용.
- **#160 모달 재디자인** —
  - 발행/기간별 정리: 스코프·범위 **아이콘 카드**(목업 합의 후 구현).
  - 드로어 **솔리드 화이트**(글래스가 뒤 어두운 걸 비춰 본문이 어둡던 것 해결).
  - 기간별 정리 **작게 시작 → 모으기 시 폭·높이 쭈욱 펼침** 애니메이션.
  - 라이트 글래스 밝게(어두운 오버레이 비침 제거)·다이얼로그 onOpenAutoFocus(X 포커스 링 제거).
  - 발행 진행 화면 **연결 stepper**(채워지는 라인)·진행 바 1개로.

## 시행착오 / 결정
- **발행 완료·목록 갱신 버그**: 자동 발행 등 렌더러가 트리거 안 한 실행은 완료돼도 세션 done 처리·목록 갱신이 안 됨 → core-runner 가 `cairn:run-done` 브로드캐스트, 렌더러가 수동·자동 통일로 처리. (별도 ADR 불요 — 버그 수정)
- Electron 미리보기 불가라 비주얼은 목업(visualize)으로 방향 합의 후 cairn 톤 구현 + 사용자 화면 검증 반복.

## 발행 출력 정리 (core, 같은 0.23.1 배치)
사용자 피드백: ① 어느 날 Work 만 작업해도 `### Work`/`### Personal` 둘 다 보고 싶다(빈 계정 None) ② Notion "Source counts" 가 `gh:6 / git:0 / hrs:...` 로 지저분하고, 커밋은 소스/계정 구분 없이 "그날 총 커밋" 으로 보고 싶다.

- **설정 계정 항상 표시(빈 계정 None)** — `GithubActivity.accountLabels`(설정 계정 전체)를 수집기→요약(payload `configuredAccounts`)→발행자(`buildDoneBlocks(bullets, accountLabels)`)로 흘림. 설정 계정 ≥2 면 활동 유무 무관 모든 계정을 `### ` 로, 작업 없는 계정은 `None`. 프롬프트는 `configuredAccounts.length>1` 일 때 모든 PR bullet 에 `[Label]` 접두, 빈 계정 placeholder 는 발행자가 붙임. → **ADR 0026**(0024 확장). 테스트: done-grouping.spec(None), summarizer-tools.spec(configuredAccounts).
- **그날 총 커밋 합산** — `formatSourceCounts` 의 커밋 수 = 모든 GitHub 계정 PR 커밋(commitsOnDate) + 로컬 커밋. `git:` 키는 backward-compat 로 유지하되 값 의미를 "총 커밋"으로 확장 → desktop 리스트 파서 무변경으로 자동 반영(PR 아이콘 + 총 커밋).

## 시행착오 / 결정 (추가)
- `git:` 키 rename(→`commit:`) 은 과거 발행 페이지의 desktop 파서 호환을 깨서 안 함 — 값 의미만 확장.
- 같은 repo 가 GitHub PR + 로컬 양쪽에 잡히면 커밋 이중 계수 가능(엣지) — 사용자가 "총합" 원해 수용.
- 버전: UI·버그·이 출력 정리 한 라운드를 minor(0.24.0)로 올리려다 사용자 지적("그정도 아닌데 마이너 너무 자주") → **patch 0.23.1** 로 정정. [[feedback_version_bump_moderation]]

## 다음
- `hrs:` 히스토그램이 Source counts 에 같이 들어가 Notion 속성이 지저분 — 별도 "Hours" 속성으로 분리 또는 시간대 차트 재검토(스키마 변경이라 사용자 확인 후).
- 발행 진행 화면 추가 폴리시.
