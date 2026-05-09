# 2026-05-09 — summarizer daily

> 진행 단계: **5 — Summarizer agent harness (daily)** ✅ (2026-05-09 완료)
> 상태: 완료

## 완료

- `@anthropic-ai/claude-agent-sdk` 0.2.138 + `vitest` 4.1.5 의존 추가. `pnpm test` / `pnpm test:watch` script
- `claude-agent-sdk` 의 OAuth 인계 검증 완료 — `ANTHROPIC_API_KEY` 없는 환경에서도 본인 Claude Code 로그인 인증 자동 사용 (모델 `claude-opus-4-7[1m]`). ADR 0001 의 "추가 과금 0원" 그대로 유효
- `src/contracts/worklog-summary.types.ts` — `WorklogSummary` (`paragraphKo` + `doneBullets` / `inProgressBullets` / `notesBullets`) + 운영자 전용 `WorklogSummaryUsage`
- `docs/decisions/0009-summarizer-auth-and-sanitize.md` — multi-auth (OAuth 인계 / API key / fallback) + 외부 송신 sanitize 정책 + 운영자 차등 (CAIRN_OPERATOR_SECRET hash) ADR
- `src/common/error.ts` — `CairnError` 그대로. `src/common/sanitize.ts` 신규 (`sanitizeCairnError`, `assertNoForbiddenPayload`). `src/common/operator.ts` 신규 (`isOperator()` — sha256 hash 매칭, default null)
- `src/summarizer/summarizer-tools.ts` — `buildSummarizerTools(input): { server, getSubmission }`. claude-agent-sdk `tool()` + `createSdkMcpServer`. 도구 2 개 (`get_activity`, `submit_summary`) — 통합 도구로 토큰 / latency 효율. compute 함수 PR / commit 별 분리 가독성
- `src/summarizer/daily-summarizer.service.ts` — claude-agent-sdk `query()` loop. `max_turns: 5`, MCP server 로 cairn 도구만 노출 (preset 안 씀, claude_code default 도구 미등록), system prompt 영어 (input 토큰 절약, output 한국어 강제), result 의 `total_cost_usd` / `usage` 추출 + `isOperator()` true 시점에만 result `usage` 채움
- 실패 fallback: SDK throw / non-success result / `submit_summary` 미호출 → `null` 반환 → publisher 가 단계 4 stub (callout + raw JSON) 발행. 일지 자체는 매일 생성 보장
- vitest spec — `src/common/sanitize.spec.ts` (8 tests) + `src/summarizer/summarizer-tools.spec.ts` (3 tests) — 14 tests 통과. NestJS 컨벤션 따라 `*.spec.ts`
- `NotionPublisher` 의 children 분기 — `summary` 있으면 `buildSummaryBlocks` (callout + Summary + Done / In Progress / Notes 섹션 + isOperator 시 cost callout + raw dump toggle), 없으면 `buildFallbackBlocks` (단계 4 stub 그대로)
- `Orchestrator.runDaily` — collector → summarizer → publisher 통합. dry-run 시 summarizer / publisher 호출 X
- 검증: 실제 personal Notion 으로 `--force` 발행 → 한국어 요약 페이지 정상 생성 (Summary / Done / In Progress / Notes 섹션). isOperator false 라 cost callout 안 보임 (정상)
- 진행률 표 단계 5 ✅ 2026-05-09
- minor bump `0.5.5 → 0.6.0`

## 시행착오 / 결정

- **claude-agent-sdk 인증 검증** — 처음 docs 만 보고 "ANTHROPIC_API_KEY 강제" 로 해석해서 ADR 0001 위반 우려. 실제 SDK 시도 결과 OAuth 자동 인계 동작 확인 — 본인 Claude Code 로그인 그대로 사용 가능. ADR 0009 에 multi-auth 정책 (env > OAuth > skip) 명시
- **운영자 차등 (operator secret)** — 사용자가 "본인만 비용 추적 보고 싶고 fork 사용자는 보지 말라" 짚음. Firebase / Supabase 같은 외부 DB 검토했지만 over-engineering. sha256 hash hardcode + .env raw secret 패턴으로 default off + 본인 명시 enable. 미래 monorepo 시점에 강한 차단 (operator-only 패키지 분리)
- **MCP 통합 도구 1 개** — 처음 4 도구 (`list_done_items` / `list_in_progress_items` / `list_notes` / `submit_summary`) → 사용자 효율성 짚어서 `get_activity` 통합 1 개 + `submit_summary` 1 개 = 도구 2 개. sourceErrors 한 응답에 1 회만 (중복 제거). LLM round-trip 절약
- **system prompt 영어 + output 한국어** — 사용자가 "Claude 에 보내는 prompt 영어 → 토큰 절약" 짚음. 한국어 한 글자 ~2-3 token vs 영어 단어 ~1 token. 매일 1 회라 누적 절약 의미. system prompt / 도구 description 모두 영어, output 만 한국어 강제
- **system prompt 튜닝 2 회** — 첫 실행 시 LLM 이 commit subject / branch 이름 거의 그대로 raw dump. 1 차 튜닝 (raw 차단 + group 강제) 후 추상화 약간 완화 (예: "[cairn] 0.5.0~0.5.5 운영 안정화 줄줄이 정리"). 2 차 튜닝으로 `[프로젝트명] 의미 phrase` + 이력서 / 회고 용도 명시 + good/bad bullet 예시 inline. 3 차 튜닝은 PR body 수집 후 재검증 시점에
- **PR body 수집은 별도 미니 PR** — 단계 5 본 작업에서는 PR title 만 LLM 컨텍스트. PR description (본문) 수집은 추가 sanitize 작업 필요 (코드 본문 / 절대경로 위험) 라 분리. 본 PR 머지 후 `feat(github): PR body 수집 + sanitize` 별도 진행
- **vitest vs jest** — NestJS 표준은 jest 지만 cairn ESM-only 환경에 vitest 가 config 부담 적음. NestJS 컨벤션 일관성 위해 `*.spec.ts` 패턴 유지. 미래 NestJS DI mocking 필요해지면 jest 전환 별도 PR
- **데스크톱 앱 / 다국어 / 데이터 소스 추상화** — `docs/notes/2026-05-09-cairn-future-scope.md` 에 정리 (단계 8 이후 monorepo 시점)

## 다음

- 미니 PR — `feat(github): PR body 수집 + sanitize`. LLM 컨텍스트 풍부화 + 일지 가독성 재점검
- 단계 6 — launchd daily 자동 실행 (`feature/launchd-daily`). plist 파일 + macOS 알림 (실패 시 osascript) + pino-roll log 파일 + 외부 API 단발 실패 시 graceful 운영
