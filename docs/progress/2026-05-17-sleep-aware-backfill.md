# 2026-05-17 — sleep-aware backfill + RunAtLoad + pmset opt-in

> 진행 단계: **10 — sleep-aware backfill** ✅ (2026-05-17 완료)
> 상태: 완료

## 완료

- **CLI / RunOptions 확장** — `--backfill-days=N` (default 7, 0-60). `RunOptions.dateExplicit` / `RunOptions.backfillDays` 필드 추가. `--date` 명시 여부를 보존해서 "explicit date = single-day mode, no backfill" 분기 가능
- **`NotionPublisherService.findPublishedDates(rangeStart, rangeEnd)`** — daily 워크스페이스 첫 번째에서 `queryWorklogPagesInRange` 호출 후 발행된 날짜 `Set<string>` 반환. token / dataSourceId 누락 시 빈 Set
- **`OrchestratorService.runDaily` backfill 분기**:
  - `dateExplicit` 또는 `backfillDays === 0` 또는 `dryRun` → 기존 단일 날짜 흐름 (`runDailyForDate`)
  - 그 외 → `generatePastDates(today, N)` 으로 chronological date 배열 → `findPublishedDates` 로 발행 안 된 날짜만 추출 → chronological 순서로 `runDailyForDate(date, options, { silent: true })` 호출
  - missingDates 가 1 개 (대개 오늘) 인 정상 케이스는 알림 그대로
  - missingDates 가 2 개 이상이면 batched 알림 `cairn 일지 — N 일 backfill 완료 (rangeStart ~ rangeEnd) — 발행 M / skip K / 활동 없음 L`
- **`generatePastDates(today, days)` 헬퍼** — 오늘 포함 지난 (days-1) 일까지 총 days 개의 `YYYY-MM-DD` 배열, chronological 순서. UTC `Date.UTC(y, m-1, d - i)` 로 월 / 연 경계 자동 처리
- **plist 3 개에 `RunAtLoad: true`** — daily / weekly / monthly. 로그인 / 세션 시작 시 1회 자동 발화. backfill 과 결합해서 "노트북 닫고 자다가 다음 열 때 자동 catch up"
- **`ops/install.sh --with-wake` opt-in** — 인자 파싱 추가, `install_pmset_wake` 함수에서 `sudo pmset repeat wakeorpoweron MTWRFSU 02:55:00` 등록 + `~/.cairn/pmset-installed-by-cairn` sentinel 생성. interactive 확인 (`read -r -p`) 으로 다른 도구의 `pmset repeat` 덮어쓰기 경고
- **`ops/install.sh --uninstall` 페어링** — `uninstall_pmset_if_ours` 가 sentinel 존재 시에만 `sudo pmset repeat cancel` + sentinel 삭제. 사용자가 손으로 박은 pmset 은 건드리지 않음
- **SETUP.md / SETUP.ko.md** — §9 (launchd 등록) 에 RunAtLoad / `--with-wake` 옵션 / pmset 주의 사항 추가. 트러블슈팅 'launchd 발화 안 함' 섹션 갱신 — backfill 흐름 / `--backfill-days=0` / `--date` explicit 모드 / `--with-wake` 안내
- 진행률 표 단계 10 ✅ 2026-05-17
- minor bump `0.10.0 → 0.11.0`

## 시행착오 / 결정

- **backfill 트리거 = "no explicit --date"** — 명시적 `--date=YYYY-MM-DD` 는 "그 날짜만 정확히" 라는 사용자 의도라 backfill 끔. launchd plist 는 `--date` 안 넘기므로 자동 backfill 동작
- **backfill 범위 default 7** — 한 주 닫고 자는 case 까지 cover. 비용 = (최대 7 일 × collect + summarize + publish). 활동 0 인 날은 summarizer 까지 안 가서 토큰 낭비 적음. user 가 더 길게 / 짧게 원하면 `--backfill-days=14` / `=3` 으로 조정
- **`backfillDays` 상한 60** — 무지성 큰 값 (e.g. 365) 으로 토큰 폭발 막기 위한 가드
- **알림 batch — 1개 vs 2개 vs N개** — missingDates 1 개면 기존 알림 그대로 (정상 daily 흐름), 2 개 이상이면 한 개 batched 알림으로 noise 방지. 결과 분류 (created / skipped / no-activity / no-target) 카운트 표시
- **`runDailyForDate(silent)` 시그니처** — backfill loop 중에는 알림 끄고, 마지막에 batched 알림 한 번. 기존 단일 호출 흐름은 그대로 (silent: false)
- **publisher 의 `--force` 와 backfill 의 관계** — `--force` 가 켜져있으면 backfill loop 의 각 날짜도 force. 사용자가 `--force` 를 전체 윈도우에 적용한 의도로 해석 (보통 단일 날짜 forced 재발행이 더 흔하지만 그건 `--date` 명시와 함께 옴 → 그 케이스는 단일 흐름)
- **pmset 시간 02:55** — 03:00 launchd 슬롯보다 5 분 일찍 깨움. Mac 이 wake → idle → launchd 03:00 fire → 작업 → idle timeout 후 sleep. 너무 가까우면 (e.g. 02:59) wake 가 안 끝난 채 fire 가 missed 될 수 있음
- **sentinel 파일 디자인** — `pmset repeat` 가 시스템 전역 1 슬롯이라 사용자가 손으로 박은 다른 wake 를 cairn 이 덮어쓸 위험. sentinel 로 "cairn 이 박았다" 표시 → uninstall 때 그 표시 있을 때만 cancel. 안전한 페어링
- **interactive confirm in `--with-wake`** — sudo + `pmset repeat` 가 다른 도구를 덮어쓸 수 있는 destructive action 이라 `read -r -p` 로 명시적 동의. install.sh 가 비대면 (CI 등) 에서 돌 일 거의 없음이지만 안전 우선
- **per-stage minor bump 정책 (ADR 0005)** — 단계 10 = 단계 단위 minor bump 0.11.0. 이게 완료되면 1.0.0 결정. ADR 0005 의 "단계 0~8" 매핑은 plan 도 진화 (단계 9, 10) 했지만 1.0.0 = "첫 stable" 시그널은 그대로

## 다음

- **운영 검증** — `pnpm build` + 로컬에서 `node dist/main.js --mode=daily --date=$(date +%F) --dry-run` (단일 모드) 으로 backfill 안 트리거 확인. 그 후 `--date` 없이 호출해서 backfill 모드 동작 확인. `ops/install.sh` 재실행으로 RunAtLoad 가 즉시 발화하는지 + 알림 노이즈 한 번으로 묶이는지 확인
- 운영 며칠 / 한 주 → 일지 / 롤업 품질 / 알림 noise / 비용 / 안정성 → 1.0.0 결정
- 그 후 v2 desktop 트랙 시작 (별도 plan `2026-05-17-cairn-v2-roadmap.md` 위에서)
