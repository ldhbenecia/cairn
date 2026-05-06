# 0008. 다중 Notion 워크스페이스 지원

- 상태: accepted
- 작성일: 2026-05-06

## 맥락

cairn 사용자(본인)는 Notion 워크스페이스를 여러 개 사용한다 — 개인용 + 회사용. Notion internal integration 은 **워크스페이스 단위** 라서 워크스페이스마다 별도 토큰을 발급해야 한다. 또 같은 사람이라도 워크스페이스마다 **user id (UUID)** 가 다르다.

plan(2026-04-26) 의 초안은 단일 `NOTION_TOKEN` / `MY_NOTION_USER_ID` env 를 가정했지만, 실제 운영에는 부족하다. 단계 3 진입 시점에 이 한계가 드러났다.

## 결정

Notion 워크스페이스 목록을 `worklog.config.json` 의 `notionWorkspaces` 배열로 두고, **수집은 다중 워크스페이스 병렬**, **발행(단계 4) 은 단일 워크스페이스** 로 한다.

스키마:

```json
{
  "localGitRepos": ["..."],
  "notionWorkspaces": [
    { "label": "personal", "tokenEnv": "NOTION_TOKEN_PERSONAL", "myUserId": "uuid-1" },
    { "label": "work",     "tokenEnv": "NOTION_TOKEN_WORK",     "myUserId": "uuid-2" }
  ]
}
```

- `label`: 사용자가 알아볼 라벨 (`personal` / `work` / 자유). 일지에 출처 구분용
- `tokenEnv`: 그 워크스페이스의 token 이 들어있는 .env 변수 이름. **secret 평문은 worklog.config.json 에 두지 않는다** (.env 와 분리)
- `myUserId`: 그 워크스페이스에서의 본인 user UUID. Notion 설정에서 직접 확인 가능 (워크스페이스마다 다름)

수집 결과는 워크스페이스 단위로 격리되어 모인다:

```
NotionActivity {
  workspaces: [
    { workspace: "personal", pages: [...] },
    { workspace: "work",     pages: [...] }
  ]
}
```

한 워크스페이스 token 만료 / 네트워크 실패는 다른 워크스페이스 수집을 막지 않는다 (`Promise.allSettled`).

envSchema 의 단일 `NOTION_TOKEN` / `MY_NOTION_USER_ID` 는 제거. 대신 사용자가 임의 이름 (`NOTION_TOKEN_PERSONAL` 등) 으로 .env 에 두고 worklog.config.json 의 `tokenEnv` 가 이름으로 참조한다.

발행(일지 페이지 / 롤업 페이지 publisher) 은 **단일 워크스페이스의 단일 DB** 로 한다 — 보통 personal. 회사 활동 + 개인 활동을 한 일지 페이지에 합쳐 personal 에 발행. 회사 워크스페이스에 별도 일지를 두고 싶으면 단계 4 시점에 옵션 추가.

## 대안

1. **단일 워크스페이스만 지원** — plan 그대로. 단순하지만 본인 케이스(개인+회사) 안 맞음.
2. **머신별 단일 워크스페이스** — 개인 노트북에선 개인, 회사 노트북에선 회사. ADR 0002 와 결합. 한 머신에서 두 워크스페이스 다 작업하는 케이스(회사 노트북에서 사이드 프로젝트도 함) 안 맞음.
3. **OAuth 기반 자동 토큰** — public integration 으로 OAuth flow. Notion 마켓플레이스 등록·심사 절차 필요. 본인용 도구에 과함. v2 도 도입 안 할 가능성 큼.
4. **선택안 (이 ADR)** — multi-workspace 지원 + tokenEnv 참조 패턴.

## 결과

- worklog.config.json 스키마 확장 → ADR 0002 portable-deploy 와 정합 (머신별 다른 워크스페이스 등록 가능)
- envSchema 의 `NOTION_TOKEN` / `MY_NOTION_USER_ID` 제거 (breaking, 그러나 단계 3 시점이라 마이그레이션 부담 X)
- secret 노출 위험 회피 — token 평문은 .env 에만, worklog.config.json 은 변수 이름만 참조
- 발행 단계(4) 는 별도 결정 (어느 워크스페이스 어느 DB) 필요. 그건 단계 4 시점에 새 ADR 또는 worklog.config.json 추가 필드.
- 댓글 추적·읽기 활동 추적은 v1 밖 (ADR 0008 범위 외, plan 본문 참조)
