# 2026-06-15 — session-catchup

> 진행 단계: 데스크톱 생산성·웹 리디자인 (마무리)
> 상태: 진행 중

여러 작업을 진행하며 progress 일지를 누락했음. 이번 세션 shipped 분을 일괄 기록(+ 다음 작업 plan 연결).

## 완료 (머지됨)

- **#143 커맨드 팔레트 (⌘K)** — 발행/날짜 이동/뷰 전환 빠른 실행.
- **#144 기간별 정리 (Done 모으기)** — 기간을 골라 Done 항목을 마크다운으로 모아 복사. 블록 유틸(`sectionBullets`/`pool`) 분리 + drawer 재사용. (최초 "성과 모으기/이력서용" → #145 에서 중립화)
- **대시보드 개선** — GitHub 스타일 히트맵(클릭→날짜 선택), 시간대(time-of-day) 차트, 빈 상태 CTA. core 는 Notion "Source counts" rich_text 에 시간 히스토그램(`hrs:`)을 piggyback(스키마 무변경).
- **웹 리디자인** — 분할 히어로(Vercel/Raycast 톤), bento, 이미지 라이트박스(createPortal), Collect 비주얼, 우측 정렬 nav. README 영문/한글(`README.ko.md`), 단일 히어로 이미지. 정사각 favicon, macOS 캡쳐 검정 배경 정리(sharp trim+rounded mask).
- **#145 워딩 중립화** — 이력서·연봉협상 프레이밍 제거 → "작업 기록/기간별 정리/돌아볼 기록"(web·core 프롬프트·desktop i18n). → memory `project_record_not_resume_framing`.

## 다음 (plan: 2026-06-15-export-account-split-run-lock)

- ① 동시 실행 락 UX 버그 (앱 시작 백필 자동 발행이 락 점유 → 수동 발행 충돌 raw 에러). busy 브로드캐스트 + i18n 친화 문구.
- ② GitHub 계정별(Work/Personal) 요약 분리 — PR 에 계정 라벨 부착 → 프롬프트 그룹화.
- ③ Markdown 로컬 내보내기 (Obsidian vault / 네이티브 메모 / 탈Notion 공통 기반).

## 시행착오 / 결정

- progress 일지를 작업 시작 시점에 안 쓰고 누락 → 사용자 지적. 앞으로 작업 단위마다 일지 선작성 규칙 재확인.
- 누적분은 묶어서 한 번에 minor 릴리스(v0.23.0 후보)로 태깅 예정(버전 인플레 방지).
