# 2026-06-13 — maintenance-sweep

> 진행 단계: 유지보수 — 전체 점검 + 성능 + 프롬프트 개선 (진행 중)
> 상태: 진행 중

## 완료

- PR #85 (릴리스 노트 Contributors 섹션) 머지
- 문서 점검: Notion 소스 제거(2026-06-03) 이후 낡은 서술 정리 (PR #86)
  - `AGENTS.md` — Notion 편집 활동 수집 문구 제거
  - `.claude/cairn-context.md` — 동일 + 제거 시점 명시
  - `docs/plans/2026-04-26-cairn-overall.md` — 부분 superseded 상태 헤더 추가, 커밋 컨벤션 서술을 rules 기준으로 정렬
  - `.claude/rules/git-conventions.md` — notion scope 의미 명확화, desktop/core scope 추가
- fix(github): lookback 시작 시각 KST 하드코딩(`-9`) → 로컬 TZ, `localDateStartIsoBefore` 로 date-window 에 합류 (PR #87)
- perf(github): 백필 반복 API 호출 프로세스 수명 캐시 — 토큰별 login + PR 별 커밋 전체 목록, Promise dedup (PR #88)
- feat(summarizer): 프롬프트 수치화·상세화 + weekly(운영 다이제스트)/monthly(이력서형 성과) 차별화 (PR #89)
- feat(prompts): 앱 내 프롬프트 커스터마이징 — 환경설정 프롬프트 탭 + CAIRN_PROMPT_* env 로 core 전달, 부가(append) 방식으로 도구 계약 보호
- fix(desktop): 발행 진행 힌트의 Notion 수집 잔재 제거

## 진행 중

- (없음)

## 시행착오 / 결정

- `computeLookbackStartIso` 에 `Date.UTC(..., -9)` KST 하드코딩 잔존 발견 — date-window 일반화(ADR 0016) 때 누락된 지점
- 백필 성능: 같은 PR 의 커밋 목록을 날짜마다 전량 재조회하는 구조 확인 → 프로세스 수명 캐시로 해결 (한 run = 한 프로세스)
- 프롬프트 커스터마이징은 전체 교체가 아니라 "추가 지시" 부가 방식 — 도구 호출 워크플로·출력 스키마 계약을 사용자가 깨지 못하게 보호

## 다음

- 전체 PR 머지 후 v0.19.0 태그 + 릴리스
