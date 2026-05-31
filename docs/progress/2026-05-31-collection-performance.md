# 2026-05-31 — collection-performance

> 진행 단계: **수집 성능 개선** (마무리)
> 상태: 완료

## 완료
- GitHub collector 의 PR body 추가 조회를 제거하고 search result 의 body 를 재사용하도록 변경.
- GitHub collector 의 commits-on-date 조회를 widened involved PR 중 추가 판정이 필요한 케이스로 제한.
- Desktop recent Notion 목록 조회를 workspace/data source 단위 병렬 처리로 변경.
- Desktop 인앱 Notion viewer 의 block pagination 누락을 보완.
- Rollup collector 의 daily page block 조회를 제한 병렬 처리로 변경.
- Local Git commit enrich 단계의 git 프로세스 동시 실행 수 제한.
- Core 내부 concurrency helper 로 GitHub/Rollup/Local Git 제한 병렬 처리 통합.
- Desktop 수동 발행 결과 판정에서 backfill 중 일부 날짜의 `no activity` 로그가 전체 성공 결과를 덮어쓰는 문제 수정.
- Daily backfill 에서 `--force` 가 켜진 경우 이미 발행된 날짜도 재발행 후보에 포함하도록 변경.
- Desktop 발행 모달의 backfill 토글 문구에 최근 7일 범위를 명시하고 CLI 인자도 `--backfill-days=7` 로 고정 전달.
- GitHub rate-limit 재시도 대기가 30초를 넘으면 즉시 실패 처리하도록 제한하고 요청 timeout 을 추가.
- Desktop 발행 결과 시스템 알림에서 `no-target` 을 완료로 오인하는 문제 수정.
- Desktop dev/build/package 스크립트가 core dist/bundle 을 먼저 갱신하도록 변경해 stale core 실행을 방지.

## 진행 중
- 없음.

## 시행착오 / 결정
- PR body 는 사용자가 직접 정리한 작업 맥락이므로 제거하지 않고 유지한다.
- 대신 별도 `pulls.get` 호출을 없애 search API 응답의 body 를 sanitize 후 재사용한다.
- `core` 와 `desktop` 의 관심사를 분리한다. backfill 대상 날짜 정책은 core 에 두고, Electron 결과 표시 오인은 desktop runner 의 로그 해석에서 보정한다.

## 다음
- 머지 후 실제 실행 로그에서 GitHub collect 시간과 Notion recent 로딩 시간 확인.
