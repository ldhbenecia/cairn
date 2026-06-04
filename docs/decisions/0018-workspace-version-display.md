# 0018. 버전 3종 — 모듈별 + 워크스페이스 통합 버전(앱 표시)

- 상태: accepted
- 작성일: 2026-06-04
- 갱신: ADR 0005 의 버전 bump 단위를 모노레포에 맞게 구체화

## 맥락

모노레포(ADR 0011)에 버전이 셋 있다:

- `packages/core` — 엔진 모듈 버전
- `packages/desktop` — 데스크톱 모듈 버전 (electron-builder 산출물·updater 가 읽음)
- root `cairn-workspace` — 워크스페이스 통합 버전

그동안 desktop-only PR 은 desktop 만, core PR 은 core+root 를 올리는 식으로 일관성이 없었고, 데스크톱 앱 About 은 desktop 모듈 버전(예: 0.3.1)을 표시해 "프로젝트 전체 버전" 과 어긋났다.

## 결정

**세 버전을 각각 그 모듈에 맞게 관리하되, root 를 통합 버전으로 삼고 앱은 root 를 표시한다.**

- **core**: core 가 바뀐 PR 에서 SemVer 로 bump.
- **desktop**: desktop 이 바뀐 PR 에서 SemVer 로 bump.
- **root(워크스페이스)**: **PR 마다 +1**(core/desktop 무엇이 바뀌든). cairn 의 공식 통합 버전.
- **데스크톱 앱이 표시하는 버전 = root**. 패키징된 앱엔 root `package.json` 이 없으므로 **빌드 시 주입**: `electron.vite.config.ts` 가 `../../package.json` 의 version 을 읽어 `__WORKSPACE_VERSION__` 으로 define → main 의 bootstrap `version` 과 텔레메트리 `app_version` 이 이를 사용. `app.getVersion()`(=desktop 모듈 버전)은 표시에 쓰지 않는다.

## 대안

- **단일 버전으로 통합** — OpenUsage(Tauri)처럼 모든 매니페스트를 한 값으로. 모듈별 변경 이력이 사라져 채택 안 함.
- **root 은퇴(패키지별만)** — 한 번 검토했으나, "프로젝트 전체 버전" 신호가 필요해서 반대로 root 를 통합 버전으로.

## 결과

- 앱 About·텔레메트리는 root 버전을 보여준다(빌드 주입). desktop 모듈 버전은 artifact/updater 내부용.
- 매 PR: root +1, 바뀐 모듈(core/desktop) bump. (예: desktop-only PR → desktop bump + root +1, core 무변경)
- 릴리스 태그 등 배포 디테일(태그를 root 기준으로 할지)은 배포 작업 시 확정.
- ADR 0005 의 SemVer 매핑은 유효, bump 단위만 본 ADR 로 구체화.
