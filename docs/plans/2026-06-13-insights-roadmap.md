# 2026-06-13 — 인사이트·성장 로드맵 (대시보드 / 온보딩 i18n / 웹사이트)

> 상태: 진행 중. v0.19.x 직후 사용자가 고른 다음 묶음.
> 방향 결정(2026-06-13): "핵심 가치(꺼내 쓰는 기능)부터, 공개 제품화 여부는 보류".

## 배경

cairn 의 존재 이유는 연봉협상·이력서 자료인데, 그동안 일지가 **쌓이기만 하고 꺼내 쓰는 기능이 없었음**. 사용자가 고른 우선순위: ① 통계 대시보드 ② 온보딩 i18n ③ 홍보 웹사이트. (이력서 export 는 후순위로 보류, 통계 대시보드를 먼저.)

## 1. 통계 대시보드 (v0.20.0, 완료)

- 사이드바 "인사이트 > 통계" 탭, worklog ↔ stats view 전환
- 총계 카드(PR·커밋·활동일·활동월) + 월별 PR/커밋 막대 SVG 차트(최근 12개월)
- **데이터 소스**: 데스크톱이 이미 `listRecentPages()` 로 노션을 읽어 `recent.pages` 를 들고 있음 → 각 일지의 `Source counts`("gh:N / git:M") 를 렌더러에서 파싱·월별 집계. **추가 노션 호출·core 변경 0**. 외부 차트 라이브러리 없이 SVG.
- **한계 / 후속**:
  - `listRecentPages` 가 100건 cap → 약 100일치만. 더 긴 추이는 **페이지네이션** 또는 노션 DB `Source counts` 를 number property 로 승격해야 함 (현재 rich_text 문자열이라 집계가 파싱 의존)
  - rollup(주간/월간) 일지는 집계에서 제외(daily 만) — 중복 방지
  - 차트 hover 툴팁은 SVG `<title>` 기본 — 추후 커스텀 가능

## 2. 온보딩 i18n (다음)

- `onboarding.tsx` 한국어 하드코딩 ~47문자열 + `worklog-drawer.tsx` 2건 → i18n 키 (`onboarding.*`)
- main 프로세스 한국어(notifier 7 / tray 7 / updater 2 등 ~21건)는 렌더러 i18n 을 못 쓰므로 **별도 트랙**: `src/main/i18n.ts` + 설정의 language 를 읽어 적용. 이번 묶음에선 렌더러만, main 은 후속.

## 3. 홍보 웹사이트 + 가이드 (대시보드 스크린샷 확보 후)

- GitHub Pages(AGPL 무료 호스팅) 랜딩 + 토큰 발급 시각 가이드(GIF/스크린샷)
- 앱 온보딩에서 "자세한 가이드" 링크로 연결 (영상 번들 X)
- 영어권 타겟이면 온보딩 i18n 이 선결

## 백로그 (이 묶음 이후)

| 아이디어 | 메모 |
|---|---|
| 이력서/성과 export | 기간 선택 → highlights·수치 모아 markdown/clipboard. Share 섹션이 재료 |
| `Source counts` number property 승격 | 대시보드 집계를 파싱 의존에서 구조화 쿼리로 — 긴 추이·정확도 |
| 대시보드 페이지네이션 | 100건 cap 넘어 전체 기간 추이 |
| GitHub OAuth Device Flow | OAuth App 등록(소유자) 후. 토큰 복붙 제거 |
| 요약 모델 선택 옵션 | 속도 vs 상세함 (haiku ≈ 수배 빠름) |
| main 프로세스 i18n | notifier·tray·updater 한국어 → src/main/i18n.ts |
| 코드 서명 + 공증 | Apple Developer 확보 시. Gatekeeper + 자동 업데이트 |
| billing/SaaS | **보류** — ADR 0001·0002(클라우드 X) 전면 폐기 필요. 본인용 도구 정체성과 충돌. 정말 방향 전환 시 새 ADR 부터 |
