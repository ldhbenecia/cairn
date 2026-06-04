# 2026-06-04 — telemetry

> 진행 단계: **배포 + 자동 업데이트** 의 텔레메트리 (배포 전 필수)
> 상태: 완료
> ADR: [0017](../decisions/0017-anonymous-telemetry.md) · 플랜: [2026-06-04-release-auto-update.md](../plans/2026-06-04-release-auto-update.md)

## 완료
- 익명 사용량 텔레메트리 도입 (PostHog, opt-out) — "몇 명이 쓰는지" 정확히 파악 + 대시보드
- `posthog-node` main 프로세스. 첫 실행 시 랜덤 install UUID → distinct_id. 화이트리스트 이벤트만(`app_launched`, `publish`), autocapture 없음, `$geoip_disable`
- settings `telemetry`(기본 켜짐)·`installId`. Preferences About 탭 opt-out 토글 + 공지. privacy 문구 정직하게 보정
- README Privacy 섹션. 키 없으면 graceful 비활성, env override(기본 US cloud)

## 시행착오 / 결정
- 백엔드: Aptabase(privacy-first) 검토했으나 "정확한 고유 수+대시보드" 요구로 **PostHog** 채택(익명 UUID distinct_id) — ADR 0017
- opt-out 채택(기본 켜짐) — opt-in 은 과소집계. 신뢰 위해 공지 의무 이행
- opt-out 한 사람 수는 정확히 못 셈(끈 뒤 침묵=이탈과 구분 불가) — 끄는 순간 1회 이벤트는 하지 않기로(사용자 충분 판단)
- PostHog 기본 대시보드는 `$pageview` 기준이라 비어있음 → `app_launched` 기반 인사이트를 따로 만들어야 함

## 다음
- 빌드 후 앱 실행 → PostHog Activity 에서 `app_launched` 수신 확인
- (배포 본작업) electron-builder dist + electron-updater check+notify → 첫 릴리스
