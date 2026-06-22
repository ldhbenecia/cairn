# 리뷰 심각도 분류 기준

각 항목은 cairn 룰을 근거로 한다. 상세는 링크된 룰을 참조.

## 🚨 CRITICAL (즉시 수정 필요)

1. **외부 송신 위반**: 코드 본문/diff/patch/hunk·절대경로(`/Users/...`)·토큰/API키·이메일·사용자별 식별자가 외부 sink(Anthropic/Notion/GitHub)로 나감. `assertNoForbiddenPayload` 미적용 경로 포함 → [security-egress.md](../../../rules/security-egress.md), ADR 0003/0021
2. **타임존 단정**: `setUTCHours`·하드코딩 `+9`·KST 가정. 날짜 윈도우/스케줄/표시는 머신 로컬 TZ 기준이어야 함 → [timezone.md](../../../rules/timezone.md)
3. **null 참조 가능성**: 조회 결과를 null 체크 없이 사용, optional chaining 미사용
4. **Race condition**: 조회→갱신 사이 원자성 미보장, 동시 실행 시 상태 불일치
5. **컴파일/런타임 에러**: duplicate identifier, import 안 된 모듈 사용. `pnpm -r typecheck` 통과 여부

## ⚠️ HIGH (수정 권장)

6. **barrel/비구체 import**: `index.ts` re-export 신설, 구체 파일 경로 대신 디렉토리 import → [nestjs-conventions.md](../../../rules/nestjs-conventions.md)
7. **중복 코드**: 동일/유사 로직 2회 이상, 중복 상수/함수. util 추출 가능
8. **함수 책임 과다**: 단일 함수 50줄 초과, 3개 이상 독립 작업 수행
9. **사이드 이펙트**: 다른 기능에 미치는 영향, 의도치 않은 동작 변경
10. **테스트 누락**: 핵심 로직(egress 검사·날짜 윈도우·수집/집계) 변경 시 테스트 미작성/미수정
11. **ADR 누락**: 비자명한 결정(기술 선택·아키텍처·정책)인데 `docs/decisions/` ADR 없음 → [decisions-workflow.md](../../../rules/decisions-workflow.md)
12. **버전/일지 정책 위반**: PR마다 거듭 bump, 단계 완료 아닌데 진행률 표 갱신, 일지 미작성 → [git-conventions.md](../../../rules/git-conventions.md), [progress-update.md](../../../rules/progress-update.md)

## 💡 LOW (개선 제안)

13. **변수명 불명확**: 단일 문자(`i`,`j` 제외), 과한 축약, 기존 네이밍과 불일치
14. **타입 안정성**: `any` 사용, `as` 단언 남용
15. **불필요한 주석**: 메타/내레이션 주석. 정말 필요한 것(eslint-disable, egress/timezone gotcha, 비자명한 why)만
16. **오타 및 타이포**: 변수/함수/주석 철자·문법
