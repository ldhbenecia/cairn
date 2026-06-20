# cairn 리뷰 스타일가이드 (Gemini Code Assist)

> **언어: 모든 리뷰 코멘트·요약·PR 개요를 반드시 한국어로 작성한다.** (코드/식별자 인용은 원문 그대로)

백엔드 시니어 개발자 관점. 스타일 트집보다 **실질적 문제**(버그·레이스·호환성·보안·성능)에 집중하고, 변경 의도를 먼저 이해한다.

## 반드시 확인 (cairn 핵심 규칙)

- **외부 송신 금지**: 코드 본문/diff/패치/절대경로/토큰/이메일/식별자를 Claude·Notion·GitHub 등 외부로 보내면 안 된다. 화이트리스트(PR 제목·설명 첫 줄·변경 파일명·커밋 제목·short SHA)만. 모든 외부 payload 에 fail-closed 검사(`assertNoForbiddenPayload`). operator/디버그 덤프도 예외 아님. (.claude/rules/security-egress.md, ADR 0003/0021)
- **타임존**: 머신 로컬 TZ 기준. `setUTCHours`·하드코딩 `+9`·KST 단정 금지. 날짜 로직엔 로컬 `Date` 메서드. (.claude/rules/timezone.md)
- **통계 진실 소스**: 로컬 `~/.cairn/worklog-stats.json` (ADR 0027). 노션 속성에서 역산 의존 금지.
- **NestJS 컨벤션**: barrel `index.ts` 금지, 구체 경로 import.

## 우선순위

- CRITICAL: null 참조, 브레이킹 체인지, 레이스 컨디션, 데이터 손실(예: archive 후 create 순서), 런타임/컴파일 에러
- HIGH: 중복 로직, 과도한 함수 책임, 사이드 이펙트, 부적절한 동시성/순차 처리
- LOW: 네이밍, 문서화, 타입 안정성, 오타

## 주의

- 의도된 설계를 오탐하지 말 것 — 관련 모듈/규칙(.claude/rules/, docs/decisions/)을 먼저 참고.
- 한국어로 간결하게 코멘트.
