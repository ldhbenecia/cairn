# 2026-06-03 — liquid-glass

> 진행 단계: **Liquid Glass 스타일 토글** (완료)
> 상태: 완료

## 완료
- settings 에 `liquidGlass: 'off' | 'clear' | 'tint'`(기본 off) — 애플처럼 **선택형**(Segmented). Preferences 화면 탭
- `data-glass=clear|tint` 시 떠 있는 표면(`.glass-panel`)을 frosted/translucent 로
  - 대상: Preferences·발행 다이얼로그, 노션 뷰어 드로어, Select 드롭다운
  - clear = 더 투명(surface 48%), tint = accent 14% 틴트. 둘 다 blur(30px) saturate(1.8) + ink 14% 테두리
  - **글래스 시 다이얼로그 오버레이를 밝혀(0.28)** 뒤 콘텐츠가 frosted 로 비치게 — 효과 가시성 ↑
  - off 면 `.glass-panel` 무효 → 기존 flat(bg-surface-1) 유지
- 전환은 View Transitions 크로스페이드(테마/강조색과 동일 경로)
- 레거시 boolean(true→clear) 이관

## 시행착오 / 결정
- 메인 패널·전체 윈도우 투명화는 위험(모든 bg-surface-1 see-through) → **floating surface 만** 글래스화 (마커 클래스 `.glass-panel`)
- 진짜 macOS vibrancy(window material)는 윈도우 배경 투명 + 메인 프로세스 필요 → 후속 후보로 보류
- 실험적(experimental) 표기

## 다음
- 윈도우 vibrancy, 사이드바/카드까지 글래스 확장(필요 시)
