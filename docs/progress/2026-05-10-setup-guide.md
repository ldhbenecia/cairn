# 2026-05-10 — 셋업 가이드 + v1.0.0

> 진행 단계: **8 — 셋업 가이드 + v1.0.0** ✅ (2026-05-10 완료)
> 상태: 완료

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
- **major bump** `0.8.0 → 1.0.0`

## 시행착오 / 결정

- **영어 + 한국어 두 파일** — README.md / 코드 / API doc 은 영문이라 외부 컨트리뷰터 / fork 사용자 명분으로 영문 SETUP.md. 동시에 본인이 회사·집 노트북 셋업할 땐 한국어 버전이 자연스러움 (commit / progress 한국어 톤과 일관). 이중 유지 비용은 있지만 SETUP 은 자주 변하는 문서가 아니라 감수
- **Quick start 는 README, full guide 는 docs/SETUP.md** — README 의 Setup 블록을 다 채우면 페이지가 비대해지고 다른 컨텍스트 (License / Documentation / Status) 가 묻힘. Quick start (clone / install / build / dry-run / install.sh) 만 README 에 두고 본격 절차 / 트러블슈팅은 SETUP.md 로 옮김. README 는 "이 도구가 뭔지 + 어떻게 시작하는지" 의 1 페이지 진입점 역할
- **rollup DB 자동 부트스트랩 안내** — 사용자 셋업 부담 ↓. `worklog.pageId` 한 줄만 박으면 daily + rollup 두 인라인 DB 가 같은 페이지 안에 나란히 자동 생성됨 — SETUP 의 7번 / 트러블슈팅 모두 이 흐름 명시
- **트러블슈팅 섹션을 실제 마주친 케이스로** — 단계 7 검증 중 실제로 만난 두 케이스 (`pnpm build` 가 옛날 코드 + range 에 일지 0개로 publish skip → DB 안 만들어짐) 를 그대로 박음. 다음에 새 머신에서 같은 거 마주칠 때 즉시 reference
- **다중 머신 시나리오 명시** — ADR 0002 (portable-deploy) 의 정신을 SETUP 에 구체화. `.env` / `worklog.config.json` 의 sync 정책 (sync X / repo 절대경로만 머신마다 다름) + 멱등성으로 같은 날짜 두 머신 동시 발행 안전성 명시
- **v1.0.0 — major bump** — 단계 0~8 전부 완료. daily + weekly + monthly 파이프라인 / launchd 자동 실행 / 셋업 가이드까지 한 사용자 한 머신에서 처음부터 끝까지 작동. SemVer 정책 (ADR 0005) 에 따라 첫 안정 릴리스 표시

## 다음

- 후속 — 사용자 자체 운영 + 필요 시점에 ADR / scope notes (e.g. `docs/notes/2026-05-09-cairn-future-scope.md` 의 desktop GUI / 다국어 / data source abstraction) 진행
