# 2026-06-03 — preferences-feedback

> 진행 단계: **그룹 1 — Preferences 개편 + 의존성 정리** (완료)
> 상태: 완료
> plan: [2026-06-03-feedback-update-prompts.md](../plans/2026-06-03-feedback-update-prompts.md)

## 완료
- 미사용 의존성 제거: cmdk(command palette 검토 중 도입했다 회수), @radix-ui/react-{dropdown-menu,tabs,tooltip}
- **Preferences 탭 개편** (좌측 세로 nav + 우측 콘텐츠): 화면 / 알림 / 연결 / 결제 / 피드백 / About
- 화면 탭:
  - 테마 = 애플식 **스켈레톤 프리뷰 카드**(자동=대각선 분할 / 라이트 / 다크), 선택 시 accent 테두리 + 체크 배지
  - **강조 색(accent)** 스와치 6종 — `--color-accent` 런타임 오버라이드, settings 저장. 기본 indigo 는 스타일시트 테마별 값 유지
  - 라벨 왼쪽 / 컨트롤 오른쪽 행 레이아웃, 모달 920×600
- 피드백 탭: textarea → `mailto:jh07050@gmail.com` (앱 버전 prefill)
- 결제 탭: placeholder("준비 중")
- 기본값 변경: 테마 `dark`→`system`, 언어 `ko`→`en`
- **라이트모드 리스트 칩 대비** 보정 (테마별 `.chip-*` 색) + workspace 라벨 진하게
- **테마/강조색 전환 = View Transitions API 크로스페이드** (per-element 트랜지션의 끝-스냅/노드별 어긋남 제거, 300ms ease-in-out)
- **dev 비상주** — dev(비패키지)에선 트레이 상주/종료 차단 끔(stale 인스턴스 방지). 상주는 배포 빌드만
- 앱 창 1080×720 → 1240×760

## 시행착오 / 결정
- ⌘K command palette 폐기 — `⌘,` 가 이미 Preferences 를 염. 검토 중 도입한 cmdk 회수
- ⌘R 은 Electron 네이티브 reload 그대로
- 모달 사이즈는 Tailwind 동적 클래스(`h-100` 등)가 dev HMR 에서 재생성 안 되는 함정 → **inline style** 로 고정
- 테마 전환 부드러움: per-element CSS 트랜지션(노드별 끝 어긋남 → "탁" 스냅) → **View Transitions**(화면 전체 1회 크로스페이드)로 근본 해결
- 지표 추적 / billing / 후원 = plan 그룹 4 에 아이디어 기록(미착수)

## 다음
- 그룹 2(자동 업데이트), 그룹 3(사용자 prompt 커스텀), 그룹 4(지표·billing·후원)
