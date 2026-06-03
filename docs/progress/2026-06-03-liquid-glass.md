# 2026-06-03 — liquid-glass

> 진행 단계: **Liquid Glass 스타일 토글** (완료)
> 상태: 완료

## 완료
- settings 에 `liquidGlass: boolean`(기본 false) + Preferences 화면 탭 토글
- `data-glass=on` 시 떠 있는 표면(`.glass-panel`)을 frosted/translucent 로
  - 대상: Preferences·발행 다이얼로그, 노션 뷰어 드로어, Select 드롭다운
  - CSS: `[data-glass=on] .glass-panel { background: color-mix(surface-1 68%); backdrop-filter: blur(22px) saturate(1.5) }`
  - off 면 `.glass-panel` 무효 → 기존 flat(bg-surface-1) 유지
- 토글 전환은 View Transitions 크로스페이드(테마/강조색과 동일 경로)

## 시행착오 / 결정
- 메인 패널·전체 윈도우 투명화는 위험(모든 bg-surface-1 see-through) → **floating surface 만** 글래스화 (마커 클래스 `.glass-panel`)
- 진짜 macOS vibrancy(window material)는 윈도우 배경 투명 + 메인 프로세스 필요 → 후속 후보로 보류
- 실험적(experimental) 표기

## 다음
- 윈도우 vibrancy, 사이드바/카드까지 글래스 확장(필요 시)
