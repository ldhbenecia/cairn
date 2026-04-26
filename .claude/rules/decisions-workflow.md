# 결정 기록 (ADR) 워크플로우

## ADR을 써야 하는 경우

비자명한 결정. 예시:
- 기술 선택 (라이브러리, 프레임워크, 모델)
- 아키텍처 패턴 (어디에 어떤 책임을 둘지)
- 보안·비용·운영 정책
- 컨벤션 (네이밍, 브랜치, 머지 전략)
- "왜 그렇게 했지"가 6개월 뒤 본인이 봐도 떠오르지 않을 만한 결정

## ADR을 안 써도 되는 경우

- 자명한 구현 선택 (변수명, 함수 분리)
- 코드만 봐도 명확한 것
- 임시 디버깅·실험

## 파일 위치 / 이름

`docs/decisions/NNNN-kebab-case.md`

- `NNNN`: 4자리 숫자, 1부터 순차 증가 (`0001`, `0002`, ...)
- 새 ADR 추가 시 직전 번호 +1
- 한 번 머지된 ADR은 **삭제 금지**. 변경하려면 새 ADR로 supersede 처리(상위 ADR이 이전을 superseded라고 명시).

## ADR 템플릿

```markdown
# NNNN. <결정 제목>

- 상태: proposed / accepted / superseded by NNNN
- 작성일: YYYY-MM-DD

## 맥락
<왜 이 결정이 필요한지. 어떤 문제·제약·외부 요인이 있었는지>

## 결정
<무엇을 결정했는지. 단호하게.>

## 대안
<고려했지만 채택하지 않은 옵션과 그 이유>

## 결과
<이 결정으로 어떤 트레이드오프가 생기는지. 후속 작업·제약>
```

## 작성 흐름

1. 결정해야 할 시점에 ADR 파일을 새로 만든다 (proposed 상태)
2. 결정이 확정되면 상태를 accepted로 바꾸고 commit (`docs(decisions): add ADR NNNN-...`)
3. PR 본문의 "Related" 섹션에 ADR 번호 적기
4. 결정이 뒤집히면: 새 ADR 추가 + 이전 ADR 상태를 `superseded by NNNN`으로 변경

## 기존 ADR 참조

핵심 ADR:
- `0001-use-claude-agent-sdk.md` — Anthropic API 직접 호출 X
- `0002-portable-deploy.md` — 머신 분리 / 시크릿 정책
- `0003-no-code-body-egress.md` — 코드 본문 외부 송신 금지
- `0004-nestjs-conventions.md` — 네이밍·디렉토리 규칙
- `0005-versioning-policy.md` — SemVer + PR 단위 bump
