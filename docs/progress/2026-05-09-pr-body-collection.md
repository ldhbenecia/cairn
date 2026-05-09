# 2026-05-09 — PR body 수집 + sanitize 완화 + usage 정확도

> 진행 단계: 단계 5 ~ 6 사이 미니 PR (단계 5 마감 후 후속)
> 상태: 완료

## 완료

- `GithubApiClient.fetchPrBody(owner, repo, n)` — `pulls.get` 호출. PR description 본문 fetch
- `GithubCollectorService.fetchSafeBody` — 800 char 길이 cap + `assertNoForbiddenPayload` 검증. fail 시 그 PR body 만 null + warn (다른 PR 영향 X). fetch 자체 실패도 graceful (network / 권한)
- contracts `GithubPrSummary.body: string | null` 추가 (화이트리스트)
- summarizer-tools 의 `DonePrItem` / `OpenPrItem` 에 body 필드 — `get_activity` 응답 payload 에 동봉
- system prompt 보강 — "PR.body 가 있으면 그 안의 핵심 키워드 / 작업 사항을 반드시 활용해서 구체적으로 작성 (추상화로 정보 손실 방지)"
- sanitize 정규식 정비:
  - `diff` / `patch` 단어 단순 매칭 제거 — false positive (PR 의 "patch bump" / "diff 정리" 같은 일반 단어 차단됨)
  - `unified-diff-hunk` strict 화 — `/@@/` 두 글자 → `/@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/` 진짜 hunk header 형태만
  - `diff-git-header` 추가 (`\bdiff --git\b`)
- vitest spec 추가 — sanitize 의 PR body 시뮬레이션 (정상 markdown 통과 / unified-diff hunk 차단 / diff/patch 단어 통과 / `diff --git` header 차단). 16 tests passing
- `DailySummarizerService` usage 추출 fix:
  - 1 차 시도 (assistant turn message.usage 누적) → 마지막 turn 만 잡혀 input 14 / output 75 부정확
  - 최종: `SDKResultSuccess.modelUsage` (모델별 누적) 사용 + cache 토큰 합산 (`cacheReadInputTokens` + `cacheCreationInputTokens`). Claude Code prompt caching 활용 시 cache_read 가 input 의 대부분
- 운영자 `OPERATOR_SECRET_HASH` 활성 — 본인 머신 .env 의 `CAIRN_OPERATOR_SECRET` 의 sha256 hash 코드 hardcode. 일지 페이지의 cost callout 표시
- 검증 (실제 personal Notion + Fine-grained PAT):
  - 7 PRs 모두 body 통과 — `pr body contains forbidden pattern` warn 0
  - usage 정확: input 131K / output 1.5K / $0.243
  - cost callout 페이지에 정상 표시
- patch bump `0.6.0 → 0.6.1`

## 시행착오 / 결정

- **첫 sanitize false positive 5/7** — `\bdiff\b` / `\bpatch\b` 단순 매칭이 PR description 의 일반 단어 ("patch bump 0.5.x" 같은) 까지 차단. 단어 매칭 자체가 너무 broad → 단어 정규식 제거. 진짜 위험 (unified-diff format) 만 strict 화
- **두 번째 false positive 1/7** — `@@` 두 글자 매칭. PR body 안 mention / 자동 review comment 의 `@@` 까지 잡음 → hunk header 형식 (`@@ -N,N +N,N @@`) 만 매칭하도록 strict
- **usage metric 추적 시행착오** — claude-agent-sdk 의 `SDKResultSuccess` 에 `usage` (마지막 turn) + `modelUsage` (모델별 누적) 두 개. usage 가 정확한 누적인 줄 알았다가 14 token 같은 값에 의문. SDK type def 직접 확인 후 `modelUsage` 발견. cache 토큰 합산 까지 해야 cost 와 매칭 — Claude Code prompt caching 활용 패턴
- **operator hash 코드 commit 결정** — sha256 one-way hash 라 raw secret 역산 사실상 불가능 (32자 random hex). 사용자 paranoid 면 `.gitignore` file 로 분리 가능하지만 v1 단순화로 코드 hardcode. 다른 fork 사용자가 hash 봐도 본인 cairn enable 못 함
- **PR body 800 char cap** — LLM 토큰 절약 + sanitize 검사 비용 ↓. PR description 의 첫 단락 / 핵심 키워드는 보통 첫 800 char 안

## 다음

- 단계 6 — launchd daily 자동 실행 (`feature/launchd-daily`). plist 파일 + macOS 알림 (osascript) + pino-roll log 파일 + 외부 API 단발 실패 graceful 운영
