# 2026-06-03 — Preferences 피드백 + 자동 업데이트 + 사용자 prompt 커스텀

> 살아있는 plan. v0.16 IA/Preferences/온보딩/인앱 뷰어/수집 성능(~v0.15.8) 이후 남은 덩어리를 PR 시리즈로.
> roadmap: [2026-05-17-cairn-v2-roadmap.md](2026-05-17-cairn-v2-roadmap.md) · 직전 단기 plan: [2026-05-30-v0.16-near-term.md](2026-05-30-v0.16-near-term.md)

## 그룹 1 — Preferences 피드백 + 의존성 정리 (이번)

### 1.1 피드백 보내기

- Preferences 에 "피드백" 섹션 — 입력(textarea) + 보내기 버튼
- 백엔드 없이 `mailto:jh07050@gmail.com` 으로 사용자 기본 메일 클라이언트를 앱 버전 prefill 해서 엶 (서버리스 — ADR 0002)
- 사용자가 직접 보내는 메일이라 egress 정책(ADR 0003)과도 무관

### 1.2 의존성 정리

- 미사용 라이브러리 제거: `cmdk`(command palette 검토 중 도입했다가 회수), `@radix-ui/react-dropdown-menu` · `@radix-ui/react-tabs` · `@radix-ui/react-tooltip`(IA 개편 중 넣었다가 최종 디자인에서 미사용)

### 폐기된 항목

- **⌘K command palette + 단축키** — `⌘,` 가 이미 Preferences 를 열어 충분(사용자 판단). `⌘R` 은 Electron 네이티브 reload 그대로 둠(Slack/Discord 와 동일). 별도 list refresh 명령/단축키 미도입.
- Schedule(launchd 시각 편집) / Advanced — 직전 plan 의 스코핑 결정 유지(보류/드롭)

### 후속 후보

- Worklog 기본값(backfill/force default) — Preferences 에 둘 수 있으나 수요 확인 후

### 버전

- 작은 기능 + 정리 → desktop v0.1.7 → v0.1.8, root v0.15.8 → v0.15.9

## 그룹 2 — 자동 업데이트 + 릴리스 (별도 PR 시리즈)

- electron-builder + electron-updater + GitHub Releases + sha256 (memory 의 release pattern, OpenUsage 참고)
- 배포 모델 정리: 패키징 앱에서 엔진 실행 경로 / launchd 등록 방식 함께 결정
- 별도 plan / ADR 후보

## 그룹 3 — 사용자 prompt 커스텀 (별도 PR 시리즈)

- 사용자 직접 요청. settings 에 `prompts: { daily, weekly, monthly }` 토대 이미 있음(현재 unused)
- Preferences 에 "Summarizer" 섹션 — 모드별 prompt template 편집기 + 변수 토큰 안내
- cairn engine 이 사용자 prompt 우선 load + fallback 기본 (engine 변경 분량 큼)
- 별도 plan / ADR(`0016-user-defined-prompts` 후보)

## 그룹 4 — 지표 추적 + billing + 후원 (아이디어, 미착수)

> 2026-06-03 사용자 발의. 일반 사용자 배포를 염두에 둔 운영/수익 논의. 아직 결정 없음 — 아이디어만 기록.

### 4.1 사용자 수 / 사용 지표

cairn 은 로컬 Electron 앱이라 서버가 없어 자연스러운 사용자 카운트가 없음. 후보:

- **GitHub Releases 다운로드 수** (인프라 0, 코드 0) — Releases API 가 에셋별 download_count 제공. "몇 명이 받았나" 의 1차 proxy. **먼저 이걸로 시작**
- **Aptabase** — 데스크톱 앱 전용 privacy-first 익명 분석(오픈소스, 무료 tier). opt-in 으로 active user / 버전 분포 / 발행 횟수 추적. 코드/diff 송신 없음(ADR 0003 무관, 이벤트 카운트만). 본격 지표는 이걸로
- 대안: PostHog/Plausible(웹 중심), Homebrew cask analytics(brew 배포 시)
- 원칙: **opt-in** + 익명 install id + 코드/경로/식별정보 절대 미송신. 별도 ADR + Preferences 토글 필요

### 4.2 billing 정책

사용자가 본인 Claude/Notion/GitHub 를 쓰므로 cairn 의 한계비용 ≈ 0 → 명확한 유료화 동인 약함. 후보:

- **무료 + 후원** (현실적 기본) — 코어는 계속 무료
- **Pro 라이선스(one-time)** — 편의 기능(커스텀 prompt 라이브러리, 멀티 프로필, 고급 롤업 템플릿, 테마/브랜딩)을 오프라인 서명 라이선스 키로 언락. 판매는 Lemon Squeezy / Polar / Gumroad (백엔드 최소). 단 로컬 앱이라 우회 쉬움 → 정직성 의존
- **호스티드 tier(먼 미래)** — cairn 이 에이전트를 대신 돌려주고 Claude 비용을 우리가 부담하는 관리형. 진짜 구독 모델이나 현재 로컬/서버리스 설계(ADR 0002)와 상충 → 별도 결정 필요
- 현재 결론: **무료 유지 + 후원 링크**. 유료화하면 one-time Pro 라이선스가 가장 현실적
- **인프라**: 자체 서버는 안 띄움(ADR 0002). billing/라이선스 상태가 필요하면 **Supabase 같은 무료 BaaS** 로 키 검증·상태만 관리 (서버리스). 결제는 Lemon Squeezy/Polar/Gumroad 가 처리
- UI: Preferences 의 **Billing 탭**(현재 placeholder "준비 중") 을 정책 확정 시 채움

### 4.3 후원 / sponsorship

- **GitHub Sponsors** (개발자 친화, 수수료 0, 정기+일시)
- **Buy Me a Coffee / Ko-fi** (해외/캐주얼 일시 후원)
- **Polar / Lemon Squeezy** (후원 + 라이선스 판매 겸용)
- 구현: Billing(또는 About) 탭에 "후원 / Support cairn" 링크 → `openExternal(후원 URL)`. **URL 만 생기면 추가는 trivial** — 사용자가 계정 만들고 URL 전달 필요

## 작업 규칙

- 그룹별 PR 시리즈 직렬화 — 직전 그룹 머지 후 다음 시작
- 비자명한 결정은 ADR
