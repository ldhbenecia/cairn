# 외부 송신 (egress) 보안 규칙

## 절대 금지

회사 코드의 본문/diff/파일 내용을 외부 API(Anthropic 포함)로 절대 송신하지 않는다. 한 바이트도.

## 외부로 나가도 되는 것 (화이트리스트)

- PR 제목, 설명(첫 줄 정도), 라벨, 머지 상태
- 변경된 파일의 **이름만** (경로 X, 절대경로 X, repo 절대경로 X)
- 커밋 메시지 첫 줄 (제목)
- 커밋 short SHA (전체 SHA X)
- Notion 페이지 제목, URL, 마지막 편집 시각
- repo basename (조직명/소유자명도 가급적 X)

## 절대 외부로 나가면 안 되는 것

- diff, patch, hunk
- 파일 본문, 코드 스니펫
- 절대경로 (`/Users/...`)
- 이메일 주소, 토큰, API 키
- 사용자별 식별 정보 (사번 등)

## 강제 수단

1. **타입 정의에서 제외**: 외부 송신 페이로드 타입에 코드/diff 필드 자체를 두지 않음. agent harness에 노출되는 도구 응답 타입도 같음.
2. **단위 테스트로 강제**: 송신 페이로드 객체를 `JSON.stringify` 후 정규식으로 `diff|patch|@@|^---|^\+\+\+` 키워드 검사. 매칭되면 테스트 실패.
3. **fail-closed 검사 + graceful drop** (ADR 0021): `assertNoForbiddenPayload` 가 외부 송신 payload 에서 금지 패턴(diff·절대경로·토큰 prefix) 매칭 시 throw. 항목 단위로 검사 가능한 경로(GitHub PR body·commit subject, local-git commit subject)는 위반 항목만 drop+warn 후 계속. **자유 텍스트(subject·body)에는 마스킹을 쓰지 않는다** — `key[:=]value` 마스킹이 정상 subject 를 오탐 훼손하기 때문. 시크릿이 섞이면 마스킹이 아니라 항목 drop.
4. **로그 redaction**: pino redact paths에 `*.token`, `*.api_key`, `headers.authorization`, `env.*PAT*` 등록.
5. **에이전트 도구 격리** (ADR 0040): Claude Agent SDK `query()` 는 반드시 `isolatedAgentOptions()`(`tools: []` · `settingSources: []` · `strictMcpConfig: true`)를 펼치고, 제출용 SDK MCP 서버는 `alwaysLoad: true` 로 만든다.
   - `allowedTools` 는 "확인 없이 허용" 목록일 뿐 도구를 **제한하지 않는다**. 기본 도구(Bash·Read·Grep 등)가 남으면 입력(PR 본문·일지 불릿)에 심은 지시로 모델이 로컬 파일·env 를 읽어 Anthropic 으로 보내고 결과에 끼워 넣는다 — 위 1~3 의 payload 검사를 통째로 우회 (읽기 전용 셸·cwd Read 는 기본 허용이라 사용자 설정과 무관하게 재현됨).
   - `tools: []` 는 ToolSearch 까지 꺼서, 제출 도구가 지연 로딩되면 요약이 제출되지 않는다 → `alwaysLoad` 필수.
   - 새 `query()` 호출을 추가하면 `common/agent-isolation.spec.ts` 에 케이스를 더한다.
6. **토큰 불필요 fork 의 env**: probe·기간 정리 문서처럼 토큰이 필요 없는 core fork 는 `envWithoutSecrets()` 로 시크릿 키를 뺀 env 를 넘긴다 (메인은 복호화한 토큰을 `process.env` 에 올림).

## 보안 ADR

이 원칙의 근본은 `docs/decisions/0003-no-code-body-egress.md`, 강제 방식은 `docs/decisions/0021-egress-enforcement-fail-closed.md`, 에이전트 도구 격리는 `docs/decisions/0040-agent-tool-isolation.md`. 변경 시 새 ADR 추가.
