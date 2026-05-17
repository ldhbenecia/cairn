# 2026-05-10 — 셋업 가이드 + v0.9.0

> 진행 단계: **8 — 셋업 가이드** ✅ (2026-05-10 완료)
> 상태: 완료 (1.0.0 은 robustness 작업 — multi-account GitHub + sleep-aware backfill — 후로 연기)

## 완료

- **`docs/SETUP.md`** (영문) — 새 macOS 머신에서 cairn 을 처음부터 셋업하는 절차. 12 섹션 (~250 라인):
  1. Prerequisites — macOS / Node 24 LTS / pnpm 10+ / Claude Pro·Max 구독
  2. clone → `pnpm install` → `pnpm build`
  3. Notion integration 생성 (`https://www.notion.so/profile/integrations`) + `Read content` / `Update content` / `Insert content` 권한 + 부모 페이지 + Connections 추가 + page id 추출 (URL 끝 32자 hex → UUID 변환)
  4. `GET /v1/users/me` 로 `myUserId` 조회 curl one-liner
  5. GitHub fine-grained PAT (read-only) — Pull requests / Contents / Metadata
  6. 로컬 repo `git config user.email` 일치 확인
  7. `.env` / `worklog.config.json` 셋업 (`worklog.pageId` 만 박으면 daily + rollup DB 자동 부트스트랩)
  8. 첫 실행 — dry-run → 실제 daily → 멱등성 (skip / `--force`) → weekly / monthly 롤업
  9. `ops/install.sh` 로 daily / weekly / monthly launchd job 일괄 등록 + `launchctl list` 확인
  10. 로그 (`~/.cairn/logs/cairn-YYYY-MM-DD.log`) / launchd stdout-err / 알림 production gate
  11. 다중 머신 셋업 (회사 + 집 노트북. `.env` 머신 간 sync X, Notion / GitHub 식별자 공유, 멱등성으로 같은 날짜 충돌 방지)
  12. 트러블슈팅 — DB 안 만들어짐 (lazy 생성 — 첫 publish 시점) / `no notionWorkspace with worklog.pageId` / Notion 401·404 (integration share 누락) / 알림 미발화 (production gate) / launchd 발화 안 함 (sleep / kickstart 강제) / cost callout 운영자 차등
- **`docs/SETUP.ko.md`** (한국어) — 같은 구조의 한국어판. progress 일지 / commit / 알림 한국어 톤과 일관. 본인이 다른 머신에 셋업할 때 한국어로 그대로 따라가기 좋음
- **README** 갱신: `Status: v1.0.0 — all 8 stages complete` + Setup 섹션을 SETUP 링크 + quick start 로 축약 + Documentation 표에 SETUP.md / SETUP.ko.md 추가
- 진행률 표 단계 8 ✅ 2026-05-10
- minor bump `0.8.0 → 0.9.0` (1.0.0 보류 — 아래 결정 참조)

## 시행착오 / 결정

- **영어 + 한국어 두 파일** — README.md / 코드 / API doc 은 영문이라 외부 컨트리뷰터 / fork 사용자 명분으로 영문 SETUP.md. 동시에 본인이 회사·집 노트북 셋업할 땐 한국어 버전이 자연스러움 (commit / progress 한국어 톤과 일관). 이중 유지 비용은 있지만 SETUP 은 자주 변하는 문서가 아니라 감수
- **Quick start 는 README, full guide 는 docs/SETUP.md** — README 의 Setup 블록을 다 채우면 페이지가 비대해지고 다른 컨텍스트 (License / Documentation / Status) 가 묻힘. Quick start (clone / install / build / dry-run / install.sh) 만 README 에 두고 본격 절차 / 트러블슈팅은 SETUP.md 로 옮김. README 는 "이 도구가 뭔지 + 어떻게 시작하는지" 의 1 페이지 진입점 역할
- **rollup DB 자동 부트스트랩 안내** — 사용자 셋업 부담 ↓. `worklog.pageId` 한 줄만 박으면 daily + rollup 두 인라인 DB 가 같은 페이지 안에 나란히 자동 생성됨 — SETUP 의 7번 / 트러블슈팅 모두 이 흐름 명시
- **트러블슈팅 섹션을 실제 마주친 케이스로** — 단계 7 검증 중 실제로 만난 두 케이스 (`pnpm build` 가 옛날 코드 + range 에 일지 0개로 publish skip → DB 안 만들어짐) 를 그대로 박음. 다음에 새 머신에서 같은 거 마주칠 때 즉시 reference
- **다중 머신 시나리오 명시** — ADR 0002 (portable-deploy) 의 정신을 SETUP 에 구체화. `.env` / `worklog.config.json` 의 sync 정책 (sync X / repo 절대경로만 머신마다 다름) + 멱등성으로 같은 날짜 두 머신 동시 발행 안전성 명시
- **1.0.0 보류, 0.9.0 으로 minor bump** — 단계 0~8 모두 완료지만 일상 신뢰성에 두 가지 빈 자리가 남아있음:
  1. **macOS sleep 중 missed slot** — 노트북 닫고 자면 19:00 / 23:00 슬롯 둘 다 놓침. 다음 날 노트북 열 때 자동 catch up 안 됨
  2. **GitHub multi-account** — 회사 계정 + 개인 계정 분리 필요한데 현재 단일 `GITHUB_TOKEN`
  → 둘 다 해결하고 실제 운영 / 요약 품질 검증한 뒤 1.0.0 으로 major bump. SemVer 정책 (ADR 0005) 에 따라 "안정 릴리스" 라벨은 더 무게 있게

## 다음

- **단계 9 — GitHub multi-account** — `githubAccounts: [{ label, tokenEnv, ... }]` 로 collector 가 회사 + 개인 둘 다 동시 수집. PR 화이트리스트 타입에 account label 포함
- **단계 10 — sleep-aware backfill** — `RunAtLoad: true` 모든 plist 에 + cairn 의 daily 모드가 지난 N 일 빠진 날짜 자동 backfill. 노트북 닫고 자도 다음에 열면 일괄 채움
- 둘 다 머지 후 며칠 실제 운영 → 요약 품질 / 안정성 확인 → 그때 1.0.0
- v2 데스크탑 앱 트랙 (별도 0.x 부터) 은 엔진 안정 후 별도 plan / ADR / repo 또는 monorepo 결정과 함께 시작
