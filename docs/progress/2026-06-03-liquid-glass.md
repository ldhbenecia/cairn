# 2026-06-03 — liquid-glass

> 진행 단계: **Liquid Glass 스타일 토글** (완료)
> 상태: 완료

## 완료
- settings `liquidGlass: boolean`(기본 false). Preferences 화면 탭, **테마 바로 아래**에 **프리뷰 카드 셀렉터**(기본 / 리퀴드 글래스 — 테마 카드와 동일 UI, 선택 시 accent 테두리 + 체크)
- `data-glass=on` 시 떠 있는 표면(`.glass-panel`)을 frosted/translucent 로
  - 대상: Preferences·발행 다이얼로그, 노션 뷰어 드로어, Select 드롭다운
  - surface 52% + blur(30px) saturate(1.8) + ink 14% 테두리
  - **글래스 시 다이얼로그 오버레이를 밝혀(0.28)** 뒤 콘텐츠가 frosted 로 비치게 — 효과 가시성 ↑
  - off 면 `.glass-panel` 무효 → 기존 flat(bg-surface-1) 유지
- 전환은 View Transitions 크로스페이드(테마/강조색과 동일 경로)
- GlassCard 목업: 기본=불투명 패널, 글래스=컬러 그라데이션 위 반투명 blur 패널

## 시행착오 / 결정
- 처음 단일 toggle → 효과 약함·선택형 요청으로 off/clear/tint enum 검토 → "틴트 불필요, 기본/글래스만" 으로 다시 단순화(boolean) + 테마식 카드 UI
- 효과 강화: blur 22→30, surface 68→52%, 다이얼로그 오버레이 0.5→0.28
- 메인 패널·전체 윈도우 투명화는 위험(모든 bg-surface-1 see-through) → **floating surface 만** 글래스화 (마커 클래스 `.glass-panel`)
- 진짜 macOS vibrancy(window material)는 윈도우 배경 투명 + 메인 프로세스 필요 → 후속 후보로 보류
- 실험적(experimental) 표기

## 다음
- 윈도우 vibrancy, 사이드바/카드까지 글래스 확장(필요 시)
