# 2026-05-09 — notion publisher

> 진행 단계: **4 — Notion publisher (일지)** ✅ (2026-05-09 완료)
> 상태: 완료

## 완료

- `worklogTargetSchema` 분리 + `notionWorkspaceConfig.worklog` nested 그루핑 (`pageId` / `databaseId` / `dataSourceId`) — Notion API 어휘 그대로 (snake → camel)
- `WorklogConfigService.persistWorklogTarget` — 첫 publish 시 자동 생성된 DB id / dataSource id 를 worklog.config.json 에 직접 추가 (다음 실행 / 다른 머신 동기화 자연)
- `NotionApiClient` publisher 메서드:
  - `createWorklogDatabase` — `is_inline: true` + `initial_data_source.properties` 안에 schema (Title / Date / Tags / Source counts / Status). 응답에서 `data_sources[0].id` 추출
  - `getPrimaryDataSourceId` — `databases.retrieve` 응답의 첫 data source (db id 만 알 때 fallback)
  - `findWorklogPageByDate` — v5 `dataSources.query` (databases.query 메서드 사라짐)
  - `createWorklogPage` — `pages.create` parent 가 `data_source_id`, properties 5 개 + children (callout + toggle/code)
  - `archivePage` — `pages.update archived: true`
- `NotionPublisherService` — `ensureDatabaseAndDataSource` 가 cached → retrieve → create 순으로 fallback, 멱등성 (Status=final 절대 보호 / 기본 skip / `--force` archive→재생성)
- `NotionCollectorService` 자기참조 제외: `parentId === cfg.worklog.databaseId || cfg.worklog.dataSourceId` 면 search 결과에서 skip (cairn 일지가 자기 자신을 다시 잡는 루프 방지)
- contracts `NotionParentType` 에 `data_source_id` 추가 (v5 multi data-source). `RawNotionPage.parentId` 노출
- `Orchestrator.runDaily` — collector 결과 모아 publisher 호출. dry-run 시 publisher 실행 X
- 검증 (실제 personal Notion):
  - 첫 발행 → DB 자동 생성 + 페이지 생성 + config 자동 갱신 ✅
  - 재실행 → `kind: skipped, reason: already-published` ✅
  - `--force` → archive + recreated ✅
  - is_inline 누락 발견 → 코드 수정 + 사용자가 worklog.databaseId/dataSourceId 두 줄 지운 후 재실행 → 새 inline DB 자동 생성 ✅
- 진행률 표 단계 4 ✅ 2026-05-09
- minor bump `0.4.0 → 0.5.0`

## 시행착오 / 결정

- **Notion API v5 multi data-source 모델 (가장 큰 발견)**: SDK 만 보고 진행하다 typecheck error 로 발견. 공식 docs (developers.notion.com) 확인 후 `databases.create` 의 `properties` 가 `initial_data_source.properties` 로 옮겨졌고, `databases.query` 가 `dataSources.query` 로 분리됐고, `pages.create` 의 parent 도 `data_source_id` 사용. `databases.retrieve` 응답의 `data_sources[0].id` 로 db id → data source id 매핑. CLAUDE.md "공식 docs 가장 먼저 참조" 원칙 다시 강조됨.
- **자동화 design (옵션 B)**: 사용자 1 회 입력 = `worklog.config.json` 의 `worklog.pageId` (cairn integration connect 된 부모 페이지 ID). 나머지 (DB schema / DB id / data source id) 는 cairn 자동.
- **config 직접 수정 패턴**: worklog.databaseId / dataSourceId 를 cairn 이 실행 시 worklog.config.json 에 자동 추가. JSON 직접 read/write — 사용자 입력 영역과 cairn 자동 영역이 같은 파일 안에 layered. 머신 동기화 자연.
- **field naming**: 처음에 `worklogParentPageId` / `worklogDatabaseId` 평면 + `worklog` prefix 였음 → `worklog.config.json` 안 redundancy 라 nested 로 그루핑 (`worklog: { pageId, databaseId, dataSourceId }`). Notion API 어휘 (page_id / database_id / data_source_id) 와 1:1 매칭 (snake → camel) — 사용자 view 에서 헷갈림 회피.
- **자기참조 제외**: cairn 이 발행한 일지 페이지를 사용자가 직접 편집하면 last_edited_by 가 본인 user 로 갱신 → 다음 실행 시 다시 잡힘 → 일지 루프. parentId 가 일지 DB id 또는 data source id 면 skip 으로 차단. `RawNotionPage.parentId` 필드 추가, `SearchPageItem.parent` union 타입화 + `extractParentId` 헬퍼.
- **`is_inline: true` 누락**: 첫 검증 시 child-page DB 로 생성됨 — cairn 컨테이너 페이지에 sub-page 링크처럼 들어감. 사용자가 inline 형태 (행이 컨테이너 본문에 직접 표시) 원함 → `databases.create` body 에 `is_inline: true` 추가. 기존 DB 는 사용자가 worklog.databaseId/dataSourceId 두 줄 지우고 재실행 → cairn 이 inline 으로 새 생성. 기존 child-page DB 는 사용자가 별도 archive.
- **GITHUB_TOKEN 빈 케이스**: 단계 1 GithubCollector 가 token 없으면 throw — 단계 4 검증에서 발견. graceful fallback 은 단계 5 시점에 별도 fix 또는 미니 PR. 이번 PR 은 publisher 도메인 집중.
- **클래스 메서드 vs 모듈 함수 컨벤션**: `this.<member>` 접근 필요 → 클래스 메서드, 순수 함수 (input → output) → 모듈 레벨 `function`. publisher 의 `formatSourceCounts` / `buildBootstrapBlocks` 가 모듈 함수, `publish` / `ensureDatabaseAndDataSource` / `createPage` 는 클래스 메서드 (DI 의존).

## 다음

- 단계 5 — Summarizer agent harness (`feature/summarizer-daily`). Claude Agent SDK tool-use loop, 도구 정의, 한국어 일지 본문 생성 (callout + Done/InProgress/Notes 섹션). 외부 송신 페이로드 redaction 단위 테스트도 이 시점 도입.
- 곁들임 후보 (단계 5 PR 또는 별도 미니 PR): GithubCollector graceful fallback (token 없으면 빈 GithubActivity + warn), Notion 본문 fetch 옵션 (personal 한정 ADR + worklog.config.json `includeContent` flag).
