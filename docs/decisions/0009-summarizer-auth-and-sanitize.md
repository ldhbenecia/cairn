# 0009. Summarizer 인증 / 외부 송신 sanitize / 운영자 차등

- 상태: accepted
- 작성일: 2026-05-09

## 맥락

단계 5 (Summarizer agent harness) 진입 시점에 세 가지 정책 결정 필요:

1. **인증 방식** — `@anthropic-ai/claude-agent-sdk` 가 어떤 인증을 사용하는가. ADR 0001 ("추가 과금 0원, Claude Max quota 안에서 동작") 의 실현 가능성
2. **외부 송신 페이로드 sanitize** — Anthropic 으로 보내는 메시지에 절대경로 / token / 코드 본문 / 내부 error stack 이 들어가지 않게 강제. ADR 0003 의 구체적 적용
3. **비용 추적 정보의 가시성** — `result.total_cost_usd` / `usage` 정보를 일지 페이지에 노출할지. fork 사용자가 cairn OSS 코드를 가져가 본인 환경에서 쓰는 시나리오 고려

## 결정

### 1. 인증: multi-auth, Claude Code OAuth 인계 우선

cairn 은 검출 우선순위로 인증을 처리한다:

1. `ANTHROPIC_API_KEY` env 가 설정되어 있으면 → API key 사용 (pay-per-use). console.anthropic.com 발급
2. 그렇지 않으면 → claude-agent-sdk 가 Claude Code CLI 의 로컬 인증 (`~/.claude/`, macOS Keychain) 자동 인계. **Pro/Max/무료 사용자 모두 본인 quota 그대로 사용**
3. 둘 다 실패하면 → Summarizer skip + 일지 stub fallback (단계 4 의 callout + raw JSON 형태로 발행)

검증: `ANTHROPIC_API_KEY` 미설정 환경에서 `query()` 호출 → 본인 Claude Max 인증 자동 인계 확인됨 (모델: `claude-opus-4-7[1m]`, tools: 31).

ADR 0001 의 "추가 과금 0원" 은 "cairn 자체가 강제 발생시키는 추가 과금 0원" 으로 명확화. 본인 (Max) 은 OAuth 인계로 실제 0 과금. fork 사용자의 인증/과금은 본인 결정.

### 2. 외부 송신 sanitize

Summarizer agent 의 도구 응답 / 입력 prompt 는 **이미 화이트리스트 type** (collector 단계에서 강제) 이지만, 단계 5 시점에 추가 강제 수단 도입:

- `src/common/sanitize.ts` — 외부 송신 직전 payload 의 안전성 검증
  - `CairnError` → 외부에는 `{ source, code }` 만 (message 제외 — 내부 절대경로 / stack 노출 위험)
  - 페이로드 JSON.stringify 후 정규식 매칭: `diff|patch|@@|^---|^\+\+\+|/Users/|secret_|sk-|ntn_` 키워드 발견 시 throw
- vitest 단위 테스트로 강제 — `pnpm test` 에서 fail 하면 commit/push 실패 (단계 6 launchd 시점에 pre-push hook 으로도 강제)

### 3. 비용 추적 — 운영자 차등 (operator secret)

`result.total_cost_usd` / token usage 는 운영 시점에 매일 누적 비용 / quota 체감용. 단 fork 사용자가 본인 cairn 운영 시 비용 정보 일지에 노출 안 되도록 차등:

- `CAIRN_OPERATOR_SECRET` env (본인 .env 에 random secret)
- `src/common/operator.ts` 의 `OPERATOR_SECRET_HASH` constant (sha256 hex, hardcoded)
- 부팅 시 `sha256(env) === hardcoded` 매칭 시 `isOperator: true`
- 매칭 시에만:
  - 일지 DB schema 에 `Tokens in` / `Tokens out` / `Cost USD` column 추가
  - 페이지 properties / 본문 callout 에 usage 정보 표시
- 매칭 실패 (default) → 일지 페이지에 비용 정보 안 노출. 내부 log 는 항상 출력 (운영 디버그)

OSS 코드 default `OPERATOR_SECRET_HASH = null` — fork 사용자 환경에선 항상 false. 본인이 본인 머신에서 secret 생성 후 hash 박는 것은 자기 커밋 또는 .gitignore 분리 (미래 monorepo 시점에 강화).

차단력 한계: AGPL fork 라 사용자가 코드 수정해서 bypass 가능. 다만 default off + secret 매칭 패턴이 충분한 obscurity. 진짜 차단은 단계 8 이후 monorepo refactor 시점에 operator-only 패키지 분리.

## 대안

1. **API key 강제** (단순) — Anthropic console 발급 강제. ADR 0001 위반 + 무료/Pro/Max 사용자 차별
2. **OAuth 인계만** (추가 과금 0) — Claude Code 안 깔린 환경 막힘. 다양한 사용자 케이스 안 맞음
3. **비용 추적 자체 안 만듦** — fingerprint 자체 없음. 단순. 단 운영 디버그 가시성 약함
4. **선택안 (이 ADR)** — multi-auth + sanitize + operator secret. 본인 운영 가시성 + fork 사용자 보호 + ADR 0001/0003 준수

## 결과

- claude-agent-sdk 가 OAuth 인계 가능 검증으로 ADR 0001 그대로 유효
- 외부 송신 sanitize 단위 테스트가 단계 5 의 PR 안 강제 — 미래 collector / publisher 변경에도 자동 검증
- operator secret 패턴이 fork 사용자에게 비용 정보 노출 방지. 본인 운영 시 매일 비용 누적 추적 가능
- 인증 / 비용 / sanitize 의 layered 정책으로 다양한 사용자 케이스 graceful 운영

## 미래 비전

이 ADR 은 v1 (CLI / 개발자 사용자) 가정. 데스크톱 앱 GUI 인증 / 비-개발자 셋업 / GitHub 외 데이터 소스 (GitLab / Bitbucket / 비-Git) 같은 미래 비전은 [docs/notes/](../notes/) 에 모음. 시점이 오면 별도 ADR 로 승격.
