# 2026-05-09 — launchd daily 자동 실행

> 진행 단계: **6 — launchd daily** ✅ (2026-05-09 완료)
> 상태: 완료

## 완료

- `pino-roll` 4.0 의존 추가
- `LoggingModule` 의 transport 분기:
  - `isProduction` true (launchd / NODE_ENV=production) → `pino-roll`. 파일: `~/.cairn/logs/cairn-YYYY-MM-DD.log` (frequency: daily, dateFormat: yyyy-MM-dd, mkdir: true, extension: .log)
  - `isProduction` false (dev) → 기존 `pino-pretty` 그대로
- `NotificationService` (osascript) — `notify(title, message)`. darwin platform + production env 두 가드 통과 시 macOS notification 띄움. spawn 으로 안전 실행 + AppleScript string literal escape (백슬래시 / 큰따옴표)
- `NotificationModule` — `AppModule` / `CairnModule` 에 import
- `Orchestrator.run` — exception 전체 try/catch 후 `cairn 실패` 알림 (CairnError.from 으로 short message 추출). 정상 발행 시 결과별 알림:
  - `created` / `recreated` — `cairn 일지` 발행 / 재발행 + sourceCounts (gh/git/notion)
  - `skipped` — `cairn 일지` skip 사유 + `--force` 안내
  - `no-target` — `cairn 설정 필요` + worklog.config.json / token 안내
- `ops/com.user.cairn-daily.plist.template` — launchd plist (placeholder 형태). StartCalendarInterval 19:00 + 23:00 두 슬롯 (sleep 보강), WorkingDirectory + NODE_ENV=production, StandardOut/ErrorPath, RunAtLoad/KeepAlive false
- `ops/install.sh` — bash 헬퍼. which node / pwd / $HOME 자동 감지 + sed 치환 + `~/Library/LaunchAgents/` 배치 + `launchctl bootstrap gui/$UID`. `--uninstall` 옵션도 지원. 기존 등록 시 자동 해제 후 재등록 (멱등)
- 진행률 표 단계 6 ✅ 2026-05-09
- minor bump `0.6.1 → 0.7.0`

## 시행착오 / 결정

- **launchd 의 Schedule TZ** — `StartCalendarInterval` 의 시간은 시스템 TZ 기준. macOS 가 KST 면 19:00 / 23:00 KST 그대로. 별도 TZ env 셋 불필요
- **sleep 보강 두 슬롯** — 노트북 sleep 시 launchd 가 wake 후 catch up 안 함 (Anacron 같은 거 X). 19:00 / 23:00 둘 다 등록 → cairn 멱등성 (Notion DB query 로 같은 Date 페이지 확인) 으로 중복 발행 X
- **plist placeholder + install.sh 치환 패턴** — node 경로 (volta / nvm / homebrew) 머신마다 다름. plist 에 hardcode 금지 → template + sed 치환. ADR 0002 portable-deploy 와 일관
- **`launchctl bootstrap gui/$UID`** — 사용자 GUI session domain. system 도메인 (`system/`) 이 아니라 GUI 라야 osascript 알림 / Keychain / GUI 권한 동작
- **`pino-roll` extension 옵션** — file 의 base 가 `~/.cairn/logs/cairn` 이고 `.log` extension + dateFormat 결합 시 `cairn-YYYY-MM-DD.log` 형태. 일자별 분리 + grep 친화
- **알림 문구 한국어** — 사용자 본인이 보는 거라 한국어 자연스러움. title `cairn 일지` / `cairn 실패` / `cairn 설정 필요` 분기. body 에 sourceCounts 같이 상태 정보
- **production 분기로 dev 알림 차단** — 개발자가 dry-run / 직접 실행할 때 매번 알림 뜨면 noise. NODE_ENV=production (launchd) 일 때만 알림

## 다음

- 단계 7 — 롤업 (weekly + monthly). plist 2 개 추가, 일지 DB query → Rollup agent harness → 별도 롤업 DB 발행
- 단계 8 — `docs/SETUP.md` 셋업 가이드 (다른 머신 설치 절차 / Notion integration / Anthropic 인증 / launchd 등록 흐름) + v1.0.0
