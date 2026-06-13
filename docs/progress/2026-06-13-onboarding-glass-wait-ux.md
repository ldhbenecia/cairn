# 2026-06-13 — onboarding-glass-wait-ux

> 진행 단계: 기능 묶음 — 온보딩 UX · 발행 대기 UX · 리퀴드 글래스 · 일지 양식 (마무리)
> 상태: 완료

## 완료

- feat(desktop): 온보딩 강화 (PR #94) — 토큰 붙여넣기 800ms 디바운스 자동 검증, prefix 형식 감지(Notion↔GitHub↔Anthropic 교차 안내), GitHub classic 토큰 프리필 딥링크, step indicator, Claude 단계 자동 probe, review 단계 Claude 미연결 경고
- feat(desktop): 발행 대기 UX (PR #95) — 요약 단계(실측 123s)에 수집 카운트 칩(PR n·커밋 m), 8초 순환 상태 문구 5종, 브랜드 마크 숨쉬기
- feat(desktop): 리퀴드 글래스 CSS in-app 유리로 정식화 (PR #97) — vibrancy 방식(#96)은 창 전체 유리화 + 토글 깜빡임으로 폐기(사용자 피드백), data-glass 틴트만 토글
- feat(summarizer): 일지 양식 개선 (PR #98) — Share 섹션(보고 복붙용 한 줄 bullet), 커밋 커버리지 규칙(누락 금지), done bullet 한 줄 핵심 + 수치
- chore(release): root 0.19.0 / core 0.18.0 / desktop 0.5.0 — 묶음 minor 1회 (ADR 0020)

## 시행착오 / 결정

- vibrancy(네이티브 창 유리)는 기술적으로 동작하지만 UX 비선호 — "CSS 로만 처리했을 때가 예쁘다" → in-app 유리로 확정. 다시 제안하지 않기
- Notion OAuth 는 client_secret 필수 + PKCE 미지원이라 서버 없는 데스크톱에 부적합 — 토큰 방식 유지, GitHub Device Flow 는 OAuth App 등록 후 백로그
- 일지에서 커밋이 누락된 원인은 PR 중심 그룹핑 — 스키마가 아니라 프롬프트 커버리지 규칙으로 해결

## 다음

- 백로그: GitHub Device Flow, 요약 모델 선택 옵션, 통계 대시보드, 이력서 export, 온보딩 i18n (플랜 문서 참고)
