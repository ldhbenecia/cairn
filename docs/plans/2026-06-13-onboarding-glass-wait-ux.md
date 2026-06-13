# 2026-06-13 — 온보딩 UX · 리퀴드 글래스 · 발행 대기 UX (+ 백로그)

> 상태: 진행 중. v0.18.0 maintenance sweep 직후의 다음 기능 묶음 (→ 0.19.0).

## 1. 온보딩 강화

현재: 토큰을 외부 페이지에서 직접 발급 → 복사 → 붙여넣기 → "테스트" 버튼 수동 클릭. 동작은 하지만 마찰이 큼.

### 이번에 구현

- **자동 검증**: 토큰 입력/붙여넣기 후 디바운스(800ms) 자동 probe — 테스트 버튼 클릭 불필요 (버튼은 보조로 유지)
- **토큰 형식 감지**: prefix 로 잘못된 필드에 붙여넣은 것 감지 (`ntn_`/`secret_` = Notion, `ghp_`/`github_pat_` = GitHub, `sk-ant-` = Anthropic) — 즉시 안내
- **GitHub 토큰 프리필 딥링크**: classic PAT 생성 URL 은 scope·설명 프리필 지원 — `settings/tokens/new?scopes=repo,read:user&description=cairn` 버튼 추가 (fine-grained 안내는 유지)
- **단계 인디케이터**: "1 / 6" 텍스트 → 시각적 progress dots
- **Claude 미설정 경고**: 마지막 단계에서 Claude 연결 없이 완료하면 "요약이 실패합니다" 명시 확인

### OAuth — 조사 결론 (백로그)

- **GitHub Device Flow**: 데스크톱 앱에 최적 (client_secret 불필요, client_id 는 공개 OK). 브라우저에서 코드 입력 → 토큰 자동 수신. **선행 조건: GitHub OAuth App 등록(소유자 작업)** — client_id 확보 후 구현. 토큰 복붙 자체를 없앨 수 있는 유일한 경로.
- **Notion OAuth**: public integration 은 client_secret 필수 + PKCE 미지원 → 중계 서버 없는 데스크톱 앱에는 부적합 (ADR 0002 클라우드 비사용과 충돌). 토큰 방식 유지가 맞음. 가이드 강화로 대응.

## 2. 리퀴드 글래스 — 구현 방향 확정

문제: CSS `backdrop-filter` 가 dev 에서는 렌더되지만 **패키징 빌드에서 렌더되지 않음** (spike/electron-liquid-glass 에서 확인된 사실).

스파이크의 교훈:
- 서드파티 `electron-liquid-glass` 네이티브 모듈 + `transparent: true` 윈도우 — 동작하지만 **토글마다 앱 재시작** 필요했고 네이티브 의존 추가
- in-app blur 는 포기하고, 떠 있는 패널은 반투명 틴트 + 하이라이트/그림자로 "유리 면"이 읽히게

### 이번 구현 (재시작 없는 내장 vibrancy)

- Electron **내장 `vibrancy`** (macOS NSVisualEffectView) — 네이티브라 dev/패키징 동일 동작, 서드파티 의존 없음
- 윈도우는 항상 `backgroundColor: '#00000000'` 로 생성, glass off 시 CSS 가 불투명 캔버스를 그림 → **`win.setVibrancy()` 런타임 토글, 재시작 불필요**
- CSS: 스파이크의 `[data-glass='on']` 틴트 이식 (사이드바 55% / 콘텐츠 72% 반투명, 패널은 단단한 틴트+하이라이트)
- macOS 한정 (다른 플랫폼은 토글 숨김/비활성)
- 환경설정 GlassCard "준비 중" 해제

## 3. 발행 대기 UX (요약 ~2분)

실측: collect 2.6s / summarize 123s / publish 2.1s — 대기의 본체는 요약.

- **수집 결과 표시**: collect 완료 로그(`prCount`, `commitCountTotal`)를 파싱해 "PR n건 · 커밋 m건 수집" 칩 표시 — 내가 뭘 요약받는지 보임
- **로테이션 상태 문구**: 요약 단계에서 8초 간격 부드러운 교체 ("PR 본문에서 맥락을 읽는 중…", "수치를 보존하며 정리하는 중…" 등 4-5개, ko/en)
- **브랜드 마크 애니메이션**: 기존 brand-mark SVG 를 활용한 subtle pulse — 새 일러스트 제작 없음 (Linear 톤 유지)
- raw 엔진 로그는 계속 비노출 (기존 정책)

## 4. 백로그 (이번 묶음 이후)

| 아이디어 | 메모 |
|---|---|
| GitHub OAuth Device Flow | OAuth App 등록(소유자) 후. 토큰 복붙 제거의 본명 |
| 요약 모델 선택 옵션 | 속도 vs 상세함 트레이드오프를 사용자 선택으로 (haiku ≈ 수배 빠름) |
| 통계 대시보드 | 월별 PR/커밋/활동일 그래프 — 연봉협상·회고 자료. 일지 DB 에서 집계 |
| 이력서용 export | 기간 선택 → highlights 모아 markdown/clipboard 로 |
| 온보딩 i18n | 현재 온보딩 문구가 컴포넌트에 한국어 하드코딩 — i18n 키로 이관 |
| 발행 미리보기 | 자동 발행 confirmBeforeRun 시 요약 미리보고 승인 |
| Notion DB 미리보기 | 온보딩에서 선택한 DB "Notion 에서 열기" 링크 |
| 코드 서명 + 공증 | Apple Developer 계정 확보 시 — Gatekeeper 해결 + electron-updater 자동 설치 |
