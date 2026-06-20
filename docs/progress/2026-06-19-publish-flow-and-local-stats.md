# 2026-06-19 — publish-flow-and-local-stats

> 진행 단계: **발행 UX 버그 정리 + 통계 아키텍처 전환** (마무리)
> 상태: 진행 중 (PR 리뷰 대기)

대시보드 고도화(#162) 검증 중 사용자가 발견한 발행 화면 버그 묶음과, 노션 속성에 통계를 의존하던
구조 문제를 함께 정리했다.

## 완료

### 발행 진행 이벤트 브로드캐스트 + 리로드 복원 (멈춤 버그)
- `cairn:run-line`/`cairn:run-step` 이 발행을 시작한 `sender` webContents 에게만 전송돼,
  발행 도중 리로드하면 새 webContents 가 step 업데이트를 못 받아 'boot'("준비하는 중")에 멈췄다.
- 전체 윈도우 브로드캐스트로 변경. 메인이 `runStartedAt`·`step`·`lastResult` 를 보관하고
  `runSnapshot()` IPC 추가, App 마운트 시 세션 복원 → 리로드 후에도 진행/완료 상태 정확.
- `runCore` 의 `sender` 인자 제거에 맞춰 auto-publish·tray 호출부 정리.

### 백필 N/M 카운터 부활
- 로그가 pino-pretty 멀티라인이라 `backfill progress`(msg)와 `done/total`(필드)이 다른 줄 →
  같은 줄 regex 가 매칭 실패해 "N개 남음" UI 가 사라졌다.
- 헤더(`[HH:MM:SS]`) 기준으로 backfill 블록을 잡아 done/total 누적(JSON 단일 라인도 처리).

### 발행 완료 알림 보강
- `sendResultNotification` 은 이미 포커스 무관하게 완료 시 항상 호출됨. macOS 가 포커스된 앱 배너를
  억제하므로 `app.dock.bounce()` 를 더해 발행 창을 보든 안 보든 확실히 알림.

### 통계 진실 소스를 로컬로 전환 (ADR 0027)
- 노션 `Source counts`(`gh/git`, 한때 `hrs:...`)는 사용자가 노션에서 지우거나 고칠 수 있어 통계가
  조작·소실될 수 있었고, 시간대 정보를 노션에 노출할 이유도 없었다.
- core 가 발행 시 `~/.cairn/worklog-stats.json` 에 `{pr, commit, hours[24]}` 기록(진실 소스).
  노션 `Source counts` 속성은 제거(일간 페이지 쓰기·신규 DB 스키마에서 빠짐).
- 롤업 collector 가 일간 metrics 를 로컬 stats 에서 합산. 데스크톱 대시보드·리스트 배지도 로컬에서.
- `RecentPage` 가 `pr/commit/hours` 를 직접 보유(노션 파싱 제거). 시간대 차트는 로컬 hours 로 그림.

## 시행착오 / 결정
- **발행 흐름 오해 정리**: 일간 백필은 날짜마다 [수집→AI 요약 1회→노션 발행 1페이지]를 통째로
  처리하고 `withConcurrency(…, 2)` 로 2날짜 병렬. "요약 몰아서 → 발행 몰아서"가 아님. 진행 스텝이
  앞으로만 움직여(`emitStep` 역행 금지) 백필 중 'publish' 에 머무는 착시였다. 느린 건 노션이 아니라
  날짜별 Claude 요약(로그 `timingMs` 가 증명). N/M 카운터 부활로 착시 해소.
- **hrs 처리 방향 2회 전환**: (1) Source counts 에 hrs 동봉 → 지저분, (2) 별도 'Activity hours'
  노션 속성 → 노션 노출은 여전, (3) 최종: 로컬 파일. 노션엔 통계 자체를 안 둔다.
- **레거시 폴백 미적용**: 사용자가 주간 재발행으로 레거시 페이지를 없앨 예정이라, 기존 노션 속성
  읽기 폴백은 넣지 않음(ADR 0027).
- 타임존: 시간대 히스토그램·스냅샷 시각 모두 로컬 메서드(KST/UTC 단정 없음).

## 다음
- 사용자 앱 검증 후 #162 에 이어 머지 / 버전 bump.
