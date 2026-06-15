# 2026-06-15 — run-lock-account-export

> 진행 단계: 자동 발행 신뢰성 · 계정 분리 · 로컬 내보내기
> 상태: 완료 (v0.23.0 릴리스)

이 세션의 shipped 작업을 묶어 기록. 작업 중 progress 일지를 제때 안 써 일괄 정리(부채 상환).

## 완료 (머지됨)
- **#146 자동 발행 시각 준수 + 동시 실행 친화** — 시작 시 백필이 예약 시각을 무시하고 오늘치를 발행하던 버그 수정. busy 브로드캐스트 + `busy:<mode>` 코드 + i18n 안내. → **ADR 0023**.
- **#147 GitHub 계정별(Work/Personal) 요약 분리** — `get_activity` payload 에 distinct accounts 추가, 계정 ≥2 면 bullet 접두/그룹 프롬프트. → **ADR 0024**.
- **#148 Markdown 내보내기** — 드로어 MD 복사 + .md 저장. 블록→Markdown 변환기.
- **#149 Obsidian 자동 동기화** — 발행 성공 시 지정 폴더에 .md 기록. 변환기 `src/shared` 분리. → **ADR 0025**.
- **#150 PDF 내보내기** — 오프스크린 BrowserWindow 렌더 → printToPDF.
- **#151 release 0.23.0** — root 0.23.0 / core 0.20.0 / desktop 0.9.0. 태그 push + draft 릴리스 publish(Latest).
- **#152 롤업 'Daily pages' 제거** — 불필요한 일자별 링크 목록 삭제.

## 시행착오 / 결정
- progress 일지·ADR 을 작업 시점에 안 남기고 PR 만 쌓음 → 사용자 지적(2026-06-15). 이 일지 + ADR 0023~0025 로 상환. **앞으로 작업 단위마다 일지 선작성 + 비자명 결정은 ADR.**
- 발행 release draft 는 electron-builder 가 의도적으로 draft 로 올림 → 확인 후 수동 publish 가 마지막 단계.

## 다음 (사용자 피드백 후속)
- Done 계정별 `### Work`/`### Personal` 서브헤딩 + 빈 Notes/InProgress 생략 (ADR 0024 발행 개정)
- 라이트 테마 색상 정합 + 발행 완료 알림 권한 UX
- 드로어 오버플로 메뉴·URL 링크화·폴더 등록해제·모델 카드 애니메이션 (#153)
