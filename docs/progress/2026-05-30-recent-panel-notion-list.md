# 2026-05-30 — recent-panel-notion-list

> 진행 단계: **v0.5+ 인앱 노션 양방향 편집 비전의 첫 발판** — Recent panel 의 노션 DB 조회 + 리스트
> 상태: 진행 중
> 관련 일지: [2026-05-30-packaged-fork-bundle](2026-05-30-packaged-fork-bundle.md)
> 관련 roadmap: [docs/plans/2026-05-17-cairn-v2-roadmap.md](../plans/2026-05-17-cairn-v2-roadmap.md) 의 v0.5+ 섹션

## 완료

(작성 시점 = 시작)

## 진행 중

- Recent panel 의 placeholder → 실제 노션 DB 조회 + 리스트
  - `packages/desktop/src/main/notion-client.ts` 신규 — 가벼운 @notionhq/client wrapper
  - desktop dependencies 에 `@notionhq/client` + `dotenv` 추가
  - `.env` 로드 (cwd 가 `~/.cairn` 또는 cairn repo 기준)
  - worklog.config.json 의 `notionWorkspaces[].tokenEnv` + `worklog.dataSourceId` 로 query
  - IPC `cairn:recent:list` → 페이지 목록 반환
  - Recent panel UI: list (date / title / workspace label) + 클릭 시 노션 외부 열기
- 인앱 viewer / 양방향 편집은 다음 단계 (v0.5.x 시리즈)

## 시행착오 / 결정

- **desktop main 에서 노션 API 직접 호출** — cairn engine 의 `NotionCollectorService` 는 NestJS 의존 무거움. desktop 의 main process 에서 `@notionhq/client` 가벼운 사용. core 와 별도 코드 경로
- **token 위치** — worklog.config.json 의 `notionWorkspaces[i].tokenEnv` = env name. `.env` (cairn repo root 또는 `~/.cairn`) load 후 `process.env[tokenEnv]` 로 추출. v0.4 의 Keychain 으로 이전 예정
- **query 대상** — `worklog.dataSourceId` (cairn engine 의 publisher 가 만든 worklog DB). 결과 sort = 최신순 (last_edited_time desc)
- **UI = 단순 list 우선** — 무한 스크롤 / 검색 / 필터는 v0.5.x 의 본격 panel 영역. 현재는 worklog DB 의 최근 30 개 정도 표시 + 클릭 시 외부 노션 열기
- **인앱 viewer / 양방향 편집은 별도 단계** — 노션 블록 → 인앱 에디터 변환은 별도 ADR 후보. roadmap 의 v0.5+ 섹션 풀어쓰기
- **packaged 시 .env 위치** — packaged app 의 cwd = `~/.cairn`. dotenv 가 자동 load. desktop main 도 동일 패턴

## 다음

- 머지 후 v0.5.x 의 다음 단계 결정 — 인앱 viewer / 양방향 / 또는 v0.2 셋업 마법사 (config GUI 편집)
