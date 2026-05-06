# 2026-05-06 — notion collector

> 진행 단계: **3 — Notion 수집** ✅ (2026-05-06 완료)
> 상태: 완료

## 완료

- `@notionhq/client` 5.20 의존
- `docs/decisions/0008-multi-notion-workspaces.md` — 다중 워크스페이스 지원 결정. 단일 `NOTION_TOKEN` / `MY_NOTION_USER_ID` 제거, `worklog.config.json` 의 `notionWorkspaces[]` 로 이전. token 평문은 .env, config 는 변수 이름만 참조
- `worklog-config.schema.ts` 확장 — `notionWorkspaces: { label, tokenEnv, myUserId(uuid) }[]` (zod v4 `z.uuid()` 사용)
- `WorklogConfigService.getNotionWorkspaces()` 추가
- `envSchema` 에서 `NOTION_TOKEN` / `MY_NOTION_USER_ID` 제거. `SecretsService` 의 노션 전용 메서드 제거 + 일반화 메서드 `getEnv(name)` / `requireEnv(name)` 추가 (임의 이름 토큰 동적 조회)
- `.env.example` / `worklog.config.example.json` 갱신
- `src/contracts/notion-activity.types.ts` — `NotionActivity` / `NotionWorkspaceActivity` / `NotionPageEdit` 화이트리스트 (페이지 id / 제목 / URL / `lastEditedAt` / `parentType` 만. 본문·블록·에디터 메타 정의 자체 X — ADR 0003)
- `src/notion/notion-api.client.ts` — 토큰별 Client 캐시(`Map<token, Client>`), `searchPages(token, { startCursor, pageSize })` 래퍼. `client.search` filter `object=page`, sort `last_edited_time desc`. 응답 narrowing 은 type-import 우회용 inline `SearchPageItem` + `isFullPage` 가드
- `src/notion/notion-collector.service.ts` — 워크스페이스별 `Promise.allSettled` 병렬, 각 워크스페이스 안에서는 cursor 페이지네이션. `lastEditedTime` 이 `[startIso, endIso]` 윈도우 벗어나면 break (sort desc 라 그 이후 페이지는 더 오래됨), `last_edited_by.id !== myUserId` skip. `MAX_SEARCH_PAGES = 50` 으로 안전 cap
- `NotionModule` + `AppModule` / `CairnModule` 에 import
- `OrchestratorService.runDaily` — github / local-git / notion 셋 다 enabled 면 `Promise.all` 병렬 수집, dry-run 시 source 별 stdout JSON dump
- 검증: `pnpm typecheck && pnpm lint && pnpm build` 통과
- 검증: 빈 `notionWorkspaces` 환경에서 `--source=notion --dry-run` → workspaces 빈 배열 + warn 1 회. 부팅 영향 없음
- 진행률 표 단계 3 ✅ 2026-05-06
- minor bump `0.3.0 → 0.4.0`

## 시행착오 / 결정

- **다중 워크스페이스 (ADR 0008)**: plan 초안의 단일 `NOTION_TOKEN` 가정은 본인 운영 (개인+회사) 에 안 맞음. 수집은 multi, 발행 (단계 4) 은 single 로 분리.
- **token 위치**: token 평문은 .env 에만, worklog.config.json 에는 `tokenEnv` 라는 변수 이름만 참조. secret 평문이 sync / 백업으로 새는 위험 회피.
- **myUserId 헬퍼 빼기**: 사용자가 Notion 설정에서 본인 UUID 직접 볼 수 있어 별도 `notion:whoami` 스크립트 불필요. 단계 8 SETUP.md 에 안내 한 줄로 충분.
- **search filter**: `object=page` 만, database 자체는 제외. 일지/롤업 DB 페이지 제외는 단계 4 (publisher) 시점에 그 DB ID 가 등록되면 그때 활성. 지금은 본인 편집 모든 페이지 잡힘 — 자기 일지 페이지 다음 실행에 자기참조로 잡히는 케이스는 단계 4 에서 같이 해결.
- **type narrowing**: `@notionhq/client` v5 의 `PageObjectResponse` 직접 import 대신, inline `SearchPageItem` 인터페이스 + `isFullPage` runtime 가드. SDK 마이너 업데이트로 type path 가 바뀌어도 깨지지 않음. 트레이드오프 — 약간의 type-loose 하지만 collector 가 specific 필드만 쓰므로 안전.
- **윈도우 break 조건**: search 가 `last_edited_time desc` 정렬이라 윈도우보다 오래된 페이지 만나면 break. 윈도우 너머 미래 (`> untilIso`) 는 단순 skip (이론상 거의 없음).
- **외부 송신 점검**: 응답 페이로드에 페이지 본문 / 블록 / 에디터 메타 / 다른 user 정보 들어가지 않음. last_edited_by.id 도 본인 myUserId 매칭 후 그 사실만 사용 (외부 송신 X). 타입 정의에 본문 필드 자체 없음 (ADR 0003). dry-run 출력 JSON 으로도 확인.

## 다음

- 단계 4 — Notion publisher (`feature/notion-publisher`). 일지 DB / 롤업 DB ID 를 `worklog.config.json` 에 추가, 같은 날 두 번 실행해도 1 개만 (`Status=final` 보호 + DB query Date 매칭), `--force` 시 archive→재생성. 자기참조 일지 / 롤업 페이지는 search 결과에서 제외.
