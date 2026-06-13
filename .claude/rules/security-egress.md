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

## 보안 ADR

이 원칙의 근본은 `docs/decisions/0003-no-code-body-egress.md`, 강제 방식은 `docs/decisions/0021-egress-enforcement-fail-closed.md`. 변경 시 새 ADR 추가.
