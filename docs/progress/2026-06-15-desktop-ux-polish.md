# 2026-06-15 — desktop-ux-polish

> 진행 단계: 데스크톱 UX 폴리시 (사용자 피드백 반영)
> 상태: 완료

## 완료
- **드로어 헤더 오버플로 메뉴** — 제목을 가리던 Share/MD/저장/PDF/Notion 아이콘들을 `⋯` 메뉴로 통합. 라벨 표시로 기능 명시 + popover 슬라이드 애니메이션. 닫기(X)만 상시 노출.
- **평문 URL 링크화** — 발행 일지는 plain text 라 링크 annotation 이 없어 URL 이 죽어 보이던 것 → 드로어 `Rich` 에서 `https?://` 자동 링크화(openExternal). 코드 span 제외.
- **export 폴더 등록 해제** — 폴더 옆 X 버튼으로 null+autoSync off. 폴더 변경 시 autoSync 토글을 강제로 켜지 않음(사용자 선택 존중).
- **요약 모델 카드 클릭 애니메이션** — transition-all + active:scale + 선택 그림자.

## 시행착오 / 결정
- 변환기(`shared/markdown`) 재사용으로 main/renderer 공유는 #149 에서 정리됨.
- 라이트 테마 색상 정합·발행 알림 권한 UX·Done 계정별 subheading·빈 Notes 생략은 별도 작업으로 분리(같은 피드백 묶음).

## 다음
- 발행자 Done 계정별 subheading + 빈 Notes/InProgress 생략 (core)
- 라이트 테마 색상 정합 + 발행 완료 알림 권한 UX (desktop)
