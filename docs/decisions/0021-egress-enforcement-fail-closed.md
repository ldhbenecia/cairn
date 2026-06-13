# 0021. Egress 강제 — fail-closed 검사 + 소스별 graceful drop (마스킹 채택 안 함)

- 상태: accepted
- 작성일: 2026-06-14

## 맥락

ADR 0003(코드 본문 외부 송신 금지)의 강제 수단으로 `security-egress.md` 는 세 가지를 적었다: (1) 타입에서 제외, (2) payload 정규식 검사 테스트, (3) **redaction 헬퍼 — 커밋 메시지의 `(api[_-]?key|token|secret|password)\s*[:=]\s*\S+` 패턴 마스킹**.

구현을 점검하니:

- (1)(2)는 충실히 구현됨. `assertNoForbiddenPayload` 가 diff hunk·`diff --git`·절대경로(`/Users/...`)·알려진 토큰 prefix(`sk-ant-`, `ghp_`, `ntn_`, `github_pat_`, `secret_`)를 정규식으로 잡고, 매칭 시 **throw** 한다 (fail-closed).
- (3) 마스킹 헬퍼는 **존재하지 않음**. 대신 GitHub PR body·PR commit subject 는 검사 실패 시 그 항목만 **drop** 한다.
- 비대칭: local-git commit subject 는 개별 검사 없이 최종 payload 백스톱(`tool.get_activity`)에만 의존 → subject 하나에 `/Users/...` 가 있으면 그날 발행 **전체**가 throw 로 중단됨.

마스킹을 그대로 구현할지 검토하다 문제를 발견했다. `(...|password)\s*[:=]` 정규식을 **자유 텍스트인 커밋 subject** 에 적용하면 정상 subject 를 망가뜨린다:

- `fix: password: reset flow` → `password:` 뒤 `reset` 이 마스킹돼 `fix: password:[REDACTED]` 로 의미 손실
- `refactor: token: 갱신 로직` 같은 정상 콜론 표기도 오탐

즉 마스킹은 **실제 시크릿(`api_key=AKIA...`)** 을 가정하고 쓴 패턴인데, 커밋 subject 처럼 사람이 쓴 한 줄 텍스트에는 오탐 비용이 크다.

## 결정

egress 강제 방식을 **fail-closed 검사 + 소스별 graceful drop** 으로 확정하고, **자유 텍스트 필드(커밋 subject·PR body)에는 마스킹을 적용하지 않는다.**

- **검사(fail-closed)**: `assertNoForbiddenPayload` 가 모든 외부 송신 payload(daily `get_activity`, rollup `get_rollup_activity`)에서 최종 백스톱으로 동작. 금지 패턴 매칭 시 throw → 송신 차단.
- **graceful drop**: 항목 단위로 검사 가능한 경로(GitHub PR commit subject·PR body, **local-git commit subject**)는 위반 항목만 빼고 warn 로그 후 계속. 발행 전체가 한 항목 때문에 죽지 않게 한다. local-git 을 GitHub 와 대칭으로 맞춤(`isForbiddenSubject` 사전 필터).
- **마스킹 미채택**: 자유 텍스트에 `key[:=]value` 마스킹은 오탐으로 정상 subject 를 훼손하므로 쓰지 않는다. 시크릿이 우연히 들어가면 마스킹이 아니라 **항목 drop + warn** 으로 처리(보수적). 토큰은 고엔트로피 prefix 로 정확히 잡는다.

## 대안

- **마스킹 헬퍼 구현(ADR 0003 문구 그대로)**: 자유 텍스트 오탐으로 정상 커밋 subject 훼손. 기각.
- **검사 없이 타입 제외만 신뢰**: 사람이 입력하는 subject·body 는 타입으로 못 막음. 런타임 검사 필수. 기각.
- **위반 시 전체 중단 유지**: 한 커밋 때문에 그날 발행이 통째로 실패 — 가용성 나쁨. drop 으로 개선.

## 결과

- `security-egress.md` 의 강제 수단 (3)을 "fail-closed 검사 + drop, 자유 텍스트 마스킹 미채택"으로 갱신.
- local-git collector 에 `isForbiddenSubject` 사전 필터 추가 — GitHub 경로와 동작 대칭.
- 테스트 보강: rollup payload egress 가드(`rollup-tools.spec.ts`), local-git subject drop(`local-git-collector.spec.ts`), 최종 payload 백스톱 negative case(`summarizer-tools.spec.ts`).
- 트레이드오프: 시크릿이 섞인 커밋은 마스킹돼 살아남지 않고 통째로 빠진다. 일지에서 그 한 줄이 누락될 수 있으나, 보안 우선 원칙(ADR 0003)에 부합한다.
