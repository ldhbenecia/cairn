# 2026-06-15 — done-grouping-empty-sections

> 진행 단계: 발행 출력 정리 (사용자 피드백)
> 상태: 완료

## 완료
- **Done 계정별 서브헤딩** — 인라인 `[Work]`/`[Personal]` 접두 대신, 발행자가 접두를 파싱해 `### Work` / `### Personal`(heading_3) 서브헤딩으로 그룹화하고 접두 제거. 접두 없으면(단일 계정) flat 유지. `buildDoneBlocks` + 단위 테스트 3건. → ADR 0024 발행 표현 개정.
- **빈 Notes/In Progress 생략** — notesBullets/inProgressBullets 가 비면 `—` placeholder 대신 섹션 자체를 생략(Share·Reviewed 와 동일). "Notes 밑에 ---만 뜬다" 피드백 해소.

## 시행착오 / 결정
- Markdown/PDF 내보내기는 발행된 Notion 블록을 읽으므로 heading_3 그룹화가 자동 반영(별도 작업 불필요).
- isOperator 게이팅(비용·원본 메타 디버그)은 기존대로 정상 — 배포 사용자 비노출 확인.

## 다음
- 라이트 테마 색상 정합 + 발행 완료 알림 권한 UX
