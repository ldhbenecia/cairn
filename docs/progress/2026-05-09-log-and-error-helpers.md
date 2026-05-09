# 2026-05-09 — log and error helpers

> 진행 단계: 단계 4 ~ 5 사이 미니 PR (PR #12 graceful fallback 후속)
> 상태: 완료

## 완료

- `src/common/error.ts` 신규 — 한 파일에 type / enum / class / factory / parser 통합
  - `ErrorSource` / `ErrorCode` const-object enum (`as const` + index lookup type)
  - `CairnError` Error class (Error 상속) — `source` / `code` / `status?` / `message`. `toJSON()` 으로 plain 직렬화 (`name` / `stack` 외부 노출 X)
  - `CairnError.from(reason, source)` static — 외부 raw error 를 CairnError 로 정규화 (Notion APIResponseError / Octokit RequestError / `Missing required secret:` pattern / generic Error)
  - `CairnError.gitRepoNotFound()` / `CairnError.gitEmailMissing()` / `CairnError.notionTokenMissing(envVar)` / `CairnError.githubTokenMissing()` static factory
  - `errorMessage(reason)` 단순 string 추출 헬퍼 (log line 용)
- 4 collector 의 error 필드 inline string / inline 객체 → `CairnError.X()` factory 호출로 통합
- contracts 3 곳 (`GithubActivity.error` / `LocalGitRepoActivity.error` / `NotionWorkspaceActivity.error`) `string` → `CairnError` type 변경
- `LoggingModule` pino-pretty options 에 `ignore: 'pid,hostname,machine'` 추가 — 매번 표시되는 noise 제거 (dev 환경 한정, prod 는 pino-pretty 안 씀)
- 검증: `--source=github --dry-run` (GITHUB_TOKEN 빈 환경) → `{ source: 'github', code: 'auth_failed', message: 'Missing required secret: GITHUB_TOKEN' }` 정상 출력. typed error 직렬화 OK
- patch bump `0.5.1 → 0.5.2`

## 시행착오 / 결정

- **typed error structure 도입 시점**: 단계 5 (Summarizer) 시점에 외부 송신 sanitize 정책과 함께 도입할 계획이었으나, 미래 데스크톱 앱 / monorepo 시점에 cairn core 가 그대로 쓸 거라 지금 잡아두는 게 리팩토링 비용 회피에 유리. 사용자 결정으로 단계 4 ~ 5 사이 미니 PR 로 분리.
- **Notion / GitHub / Stripe 의 `{ status, code, message }` 표준 패턴 따라**: 다만 cairn 은 server 가 아닌 외부 API 호출 client 라 자체 응답 만들 일은 없음. 이 typed error 는 (1) 내부 log 가독성 + (2) 단계 5 외부 송신 페이로드 sanitize 표준 두 곳에 활용.
- **외부 송신용 sanitize 는 단계 5 시점에 별도 ADR + redaction 단위 테스트** — 지금은 `CairnError.toJSON()` 이 message (자세함) 까지 포함. Anthropic 으로 송신 시 `code` + `source` 만 남기는 sanitize 헬퍼 단계 5 에 추가 예정.
- **Error class vs interface vs plain object**: 처음엔 plain interface + `parseError` 함수 시작 → 사용자 짚음 (`parseError`/`Errors.X.Y()` 형태 조잡) → Error class + static factory 통합으로 단축 (`CairnError.X()` 한 entry point). JS 표준 패턴 (Error 상속).
- **`as const` enum vs TypeScript `enum`**: TS 컨벤션 변화 — `enum` 은 런타임 객체 생성 + tree-shake 어려움. `as const` 객체 + index lookup type 이 가벼움. `ErrorSource` / `ErrorCode` 둘 다 이 패턴.
- **헬퍼 컨벤션**: `to`-prefix (toErrorMessage, toCairnError) → 짧은 동사형 (`errorMessage`, `parseError`) → 최종 class static 통합 (`CairnError.from`). 사용자 피드백 메모리에 기록 예정.
- **에러 코드/소스 enum 공용 한 파일**: 처음엔 `src/common/errors.ts` (factory) + `src/local-git/local-git.errors.ts` (도메인별) 으로 분리 시도 → 사용자 짚음 (조잡, 파일 너무 잘게 쪼갬) → `src/common/error.ts` 한 파일에 namespace 로 통합.
- **log 가독성**: `logger: false` 로 NestJS 부팅 INFO 12 줄 silent 도 검토 → 사용자 의견으로 그대로 둠 (가독성 거슬림 약하고, 부팅 실패 시 fail point 보이는 게 나음). 대신 pino-pretty `ignore: 'pid,hostname,machine'` 만 적용 — 매 line 의 noise 제거.

## 다음

- 단계 5 — Summarizer agent harness. 외부 송신 sanitize 헬퍼 (`CairnError` → `{ code, source }` 만), redaction 단위 테스트, ADR 0009 (외부 송신 페이로드 정책 확장).
- 라이센스 변경 PR (AGPL v3) 별도.
