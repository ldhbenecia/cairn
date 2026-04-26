# 0001. Claude Agent SDK 사용 (Anthropic API 직접 호출 X)

- 상태: accepted
- 작성일: 2026-04-26

## 맥락

cairn은 매일·매주·매월 Claude를 호출해서 한국어 요약과 롤업을 생성한다. 사용자는 Claude Max 구독자이며, **추가 과금 0원** 정책을 명시했다.

Claude를 코드에서 호출하는 방법은 두 가지:
1. **Anthropic API 직접 호출** (`@anthropic-ai/sdk`) — 별도 API key 필요, 토큰당 과금
2. **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) — Max/Pro subscription 인증으로 quota 안에서 동작

## 결정

**Claude Agent SDK만 사용한다.** Anthropic API 직접 호출은 사용 금지.

- 의존성: `@anthropic-ai/claude-agent-sdk`
- `@anthropic-ai/sdk`는 `package.json`에 추가하지 않음. import 시도도 금지.
- 모델 선택은 SDK 기본값 (Claude Max 구독에 포함된 최신 모델). `CAIRN_MODEL` env로 override 가능.

## 대안

- **A. Anthropic API 직접** — 일 1회 호출이라 월 $1 미만으로 매우 저렴하지만, "0원" 원칙 위반.
- **B. 로컬 LLM (Ollama)** — 0원 보장이지만 한국어 요약 품질 낮고 머신 리소스 사용. 하네스 학습은 됨.
- **C. v1에서 LLM 제외** — 통계 + 템플릿만으로 페이지 발행. 안전하지만 사용자 가치 낮음.

선택지 중 사용자 요구 (무과금 + 한국어 요약 품질 + 하네스 엔지니어링 학습)를 모두 만족하는 것은 Agent SDK뿐.

## 결과

- **장점**: 추가 과금 없음, 본인 Max 모델 그대로 사용, 하네스 엔지니어링 학습 가능
- **트레이드오프**:
  - 다른 사람이 cairn을 사용하려면 Claude Pro/Max 구독 필요 (README에 명시)
  - SDK 인증 흐름 의존 (Claude CLI/Desktop 로그인 상태에 따라 동작)
  - 정책 변경 시 영향 받을 수 있음
- **강제 수단**: ESLint custom rule 또는 단위 테스트로 `@anthropic-ai/sdk` import를 금지 (`docs/decisions/0003`의 redaction 테스트와 같은 위치에서 강제)

## 관련

- 비용/구독 정책: `docs/plans/2026-04-26-cairn-overall.md` "비용 정책" 섹션
- agent harness 설계: `docs/plans/2026-04-26-cairn-overall.md` "Summarizer agent harness 설계" 섹션
