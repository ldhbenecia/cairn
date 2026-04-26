# 2026-04-26 — github client

> 진행 단계: **1 — NestJS 스켈레톤 + GitHub 수집** (두 번째 PR / 3개 분할 중)
> 상태: 진행 중

## 완료

- `@octokit/core` + `@octokit/plugin-throttling` + `@octokit/plugin-retry` + `@octokit/plugin-rest-endpoint-methods` 설치
- `src/github/github-api.client.ts` — `Octokit.plugin(throttling, retry, restEndpointMethods)` 로 합성한 `CairnOctokit` 타입 + lazy 초기화 + `healthCheck()` (`getAuthenticated()` → `{ login }` 만 반환)
- throttle: `onRateLimit` / `onSecondaryRateLimit` 콜백, 1회 retry 후 포기, 메서드/URL/retryAfter/retryCount 만 로깅
- retry: `doNotRetry: [400, 401, 403, 404, 422]` (auth/permission/not-found/validation 실패는 재시도 무의미)
- `src/github/github.module.ts` — `GithubApiClient` provider + export
- `AppModule` 에 `GithubModule` 추가
- typecheck / lint / build / `--mode=daily --dry-run` 부팅 검증 (토큰 없이도 부팅 OK)
- patch bump `0.1.4 → 0.1.5`

## 시행착오 / 결정

- 처음 `octokit` umbrella 패키지로 시작 → throttle 콜백 파라미터에 `noImplicitAny` 에러 (umbrella 가 plugin 옵션 타입을 충분히 머지 못함). `@octokit/core` + plugins 명시 설치로 전환. plan 의 원래 의도와도 일치.
- **lazy 초기화**: 생성자에서 토큰 요구 X → `--source=notion` 같이 GitHub 안 쓰는 모드에서도 부팅 가능. 첫 API 호출 시 `secrets.requireGithubToken()` 으로 토큰 요구.
- **반환 페이로드 좁히기**: `getAuthenticated()` 응답에는 email / bio / 회사 정보 등 다 들어옴. `{ login: string }` 만 떼서 반환하는 `GithubIdentity` 타입으로 강제 (ADR 0003 화이트리스트). 다음 PR 의 collector 메서드들도 같은 패턴.
- `restEndpointMethods` 플러그인으로 `octokit.rest.users.getAuthenticated()` 같은 strongly-typed 메서드 사용 가능. 안 적용하면 `octokit.request('GET /user')` 식으로 raw endpoint 호출.

## 다음

- `feature/github-collector` PR — 4 search queries (KST→UTC 윈도우), `GithubActivity` 화이트리스트 타입(ADR 0003), `--dry-run --source=github` 검증, 단계 1 ✅ + minor `0.2.0`
