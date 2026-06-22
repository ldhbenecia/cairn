---
name: pr-review
description: PR 번호 기반 코드 리뷰 (심각도별 이슈 분류)
---

# PR 리뷰

cairn 메인테이너 관점에서 PR을 리뷰함. cairn은 NestJS standalone 엔진(core) + Electron 데스크톱 + 동기화 웹으로 구성된 pnpm 모노레포.

## 인자

$ARGUMENTS - PR 번호 (예: `123`, `#456`)

## 작업

1. **PR 정보 수집** — `./.claude/skills/pr-review/scripts/fetch-pr.sh $ARGUMENTS`로 메타데이터+diff 한 번에 가져옴 (package root 기준 경로). PR body에서 변경 의도와 맥락을 먼저 파악
2. **변경 파일 분석** — diff 맥락에서 코드 흐름 파악. cairn 고유 위험은 룰을 직접 참조 (중복 서술 안 함):
   - 외부 송신 — [.claude/rules/security-egress.md](../../rules/security-egress.md) (ADR 0003/0021)
   - 타임존 — [.claude/rules/timezone.md](../../rules/timezone.md)
   - NestJS 구조·import — [.claude/rules/nestjs-conventions.md](../../rules/nestjs-conventions.md)
   - 커밋·PR·버전 — [.claude/rules/git-conventions.md](../../rules/git-conventions.md)
3. **심각도 분류 후 출력**
   - 분류 기준: [references/severity-criteria.md](references/severity-criteria.md)
   - 체크리스트: [references/checklist.md](references/checklist.md)
   - 출력 형식: 아래

## 리뷰 철학

**핵심 질문**: "이 코드가 지금뿐 아니라 이후에도 (그리고 새로운 작업자가 배정되더라도) 이해/유지 보수가 가능한가?"

- 코드만 보지 말고 **변경 의도**를 이해할 것
- 단순 스타일 지적보다는 **실질적 문제**에 집중
- **왜 이렇게 구현했는지** 맥락을 파악하려 노력할 것
- 룰에 명시된 의도적 설계(standalone 이라 Controller 없음 등)를 오탐으로 지적하지 말 것

## 출력 형식

```
## 🚨 Critical Issues (즉시 수정 필요)

- [파일명:라인] 구체적인 문제
  ```typescript
  // 현재 코드
  ...
  // 수정 제안
  ...
  ```

## ⚠️ High Priority (수정 권장)

- [파일명:라인] 구체적인 문제와 해결 방안

## 💡 Suggestions (개선 제안)

- [파일명:라인] 구체적인 제안

## 요약

총 이슈: X개 (Critical: X개 / High: X개 / Low: X개)
주요 패턴: 발견된 공통 이슈 패턴
```