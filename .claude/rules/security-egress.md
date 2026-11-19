# 외부 송신 (egress) 보안 규칙

회사 코드의 본문·diff·파일 내용은 외부 API(Anthropic 포함)·Notion·GitHub 로 한 바이트도 보내지 않는다. 화이트리스트만 송신.

- 허용: PR 제목·설명 첫 줄·라벨·머지 상태, 변경 파일 이름(경로 X), 커밋 제목, short SHA, Notion 페이지 제목·URL·편집 시각, repo basename(조직/소유자명은 가급적 X)
- 금지: diff·patch·hunk, 파일 본문·코드 스니펫, 절대경로, 이메일·토큰·API 키, 사용자별 식별 정보(사번 등)

## 강제 수단

1. 송신 payload 타입에 코드/diff 필드를 두지 않음 (agent 도구 응답 타입도 같음)
2. 송신 payload 를 `JSON.stringify` 후 `diff|patch|@@|^---|^\+\+\+` 정규식 검사하는 단위 테스트
3. 모든 외부 payload(디버그·운영자 덤프 포함)에 fail-closed `assertNoForbiddenPayload`. 항목 단위 경로(GitHub PR body·commit subject, local-git commit subject)는 위반 항목만 drop+warn
   - 자유 텍스트(subject·body)에 마스킹을 쓰지 않음 — `key[:=]value` 마스킹이 정상 subject 를 오탐 훼손함. 시크릿이 섞이면 항목 drop
4. pino redact paths: `*.token`, `*.api_key`, `headers.authorization`, `env.*PAT*`
5. Claude Agent SDK `query()` 는 `isolatedAgentOptions()` 를 펼치고, 제출용 SDK MCP 서버는 `alwaysLoad: true`
   - `allowedTools` 는 "확인 없이 허용" 목록일 뿐 도구를 제한하지 않음. 기본 도구(Bash·Read 등)가 남으면 입력(PR 본문·일지 불릿)에 심은 지시로 로컬 파일·env 를 읽어 결과에 끼워 넣어 1~3 을 통째로 우회함
   - `tools: []` 는 ToolSearch 까지 꺼서, 제출 도구가 지연 로딩되면 요약이 제출되지 않음 → `alwaysLoad` 필요
   - 새 `query()` 호출을 추가하면 `common/agent-isolation.spec.ts` 에 케이스 추가
6. Codex 는 단일 차단 스위치가 없어 `codex-submit-agent.ts` 가 세 겹으로 막음
   - 실행마다 `codex features list` 로 켜진 기능을 전부 `--disable`. 고정 목록이면 새 버전의 도구를 놓침. 목록 형식을 못 읽으면 실행 거부
   - `--ignore-user-config`·`--ignore-rules`·`--ephemeral`, 빈 임시 cwd, `web_search="disabled"`, 자식 env 는 PATH·HOME·TMPDIR·LANG·CODEX_HOME 만
   - `--json` 이벤트에 메시지·추론 외 항목이 보이면 kill + 결과 폐기 (경합 때문에 단독 보장 아님)
   - Codex 버전을 올리면 주입 canary(도구 실행 요구 입력 → 도구 이벤트 0건, 기능 on 대조군에선 실행)로 재확인
7. desktop main 은 복호화한 토큰을 `process.env` 에 쓰지 않고 `secretValue(name)` 로 읽음 (전역 env 는 모든 fork 가 상속). 자식 core env 는 `coreChildEnv(settings, { secrets })` 로만 조립 — 토큰은 발행 run 에만, 그 외 fork 는 셸에서 export 된 같은 이름 키까지 뺌

원칙을 바꾸면 새 ADR 추가 (근거: `docs/decisions/` 의 no-code-body-egress · egress-enforcement-fail-closed · agent-tool-isolation).
