# 0012. desktop UI 스택 — Electron + Vite + React + Tailwind v4 + Radix

- 상태: accepted
- 작성일: 2026-05-30

## 맥락

ADR 0010 에서 v2 desktop app 의 셸 프레임워크를 **Electron** 으로 결정. 이제 셸 안 UI 레이어 (번들러 + UI 프레임워크 + 스타일링 + 컴포넌트 primitive) 를 정해야 함.

초기 roadmap (`docs/plans/2026-05-17-cairn-v2-roadmap.md`) 에선 "v0.1 은 vanilla HTML/TS 시작, 마법사 복잡해지면 그때 React" 라고 잠정 적혔으나, plan 작성 시점 (`docs/plans/2026-05-30-desktop-v0.1-shell.md`) 에서 Linear / Framer / Apple 톤의 디자인 시스템을 따라가기로 결정 → vanilla 한계가 명확해짐.

## 결정

**Electron + electron-vite + React 19 + TypeScript + Tailwind v4 + Radix UI primitives**.

- **번들러**: electron-vite (main / preload / renderer 동시 빌드, Vite 표준 HMR)
- **UI 프레임워크**: React 19
- **스타일**: Tailwind v4 (`@theme` directive → CSS variable 토큰)
- **컴포넌트 primitive**: Radix UI (비스타일 / 키보드 / 접근성)
- **폰트**: Inter (UI) + JetBrains Mono (로그)
- **아이콘**: lucide-react (라인 아이콘)
- **빌드 / 패키징**: electron-builder

## 대안

### A. vanilla HTML + TS (초기 roadmap 잠정안)

- **장점**: 의존성 최소. 번들 작음. 트레이 메뉴 + 1~2 화면이면 충분
- **단점**:
  - Linear / Framer / Apple 톤 디자인 토큰 관리 (색 / spacing / radius / shadow 일관성) 를 직접 짜야 함
  - log viewer / settings / 셋업 마법사 들어오는 순간 (v0.2) 결국 React 도입 필요 → 한 번 더 큰 리팩토링
  - Tooltip / DropdownMenu / Dialog / Tabs 같은 trivial 하지만 키보드 / 포커스 / 접근성을 매번 직접 짜야 함

### B. Svelte / SolidJS

- **장점**: 번들 작음, 반응성 좋음
- **단점**: 본인 React 친숙도 ↑. NestJS 백엔드 배경 + 1 인 개발에서 학습 곡선 회피가 더 가치 있음

### C. styled-components / Emotion (Tailwind 대신)

- **장점**: JS 안에서 동적 스타일링, 컴포넌트 캡슐화
- **단점**: 디자인 토큰 → CSS variable 매핑은 Tailwind v4 `@theme` 이 더 직접적. 런타임 비용 (CSS-in-JS) 도 작은 셸에서 굳이 떠안을 필요 X

### D. Mantine / Chakra / MUI (Radix 대신)

- **장점**: 컴포넌트 풍부, 즉시 사용 가능
- **단점**: 자체 스타일링 강함 → Linear 톤으로 끌고 가려면 override 가 더 비쌈. Radix 는 비스타일 primitive 라 디자인 토큰 자유

## 선택 근거

- **디자인 시스템 일관성** — Linear / Framer / Apple 톤은 토큰화된 색·spacing·typography 가 핵심. Tailwind v4 + `@theme` directive 가 CSS variable 1:1 매핑이라 토큰 관리에 가장 직접적
- **v0.2 셋업 마법사 / settings UI 어차피 필요** — 폼 / 검증 / 다단계 / 동적 상태가 들어오므로 React 가 어차피 필요. v0.1 부터 React 가는 게 일관성 / 리팩토링 비용 측면에서 합리적
- **Radix primitive** — Tooltip / Dialog / DropdownMenu / Tabs 가 트레이 앱이 결국 다 필요한 컴포넌트. 키보드 / 포커스 / 접근성 무료
- **HMR** — electron-vite 의 renderer HMR 이 UI 반복 속도 ↑
- **본인 친숙도** — React 가 학습 비용 0. TypeScript 도 engine 과 일관

## 결과

- `packages/desktop/package.json` 의 dependencies: `electron`, `react`, `react-dom`, `@radix-ui/react-*` (사용 컴포넌트만), `lucide-react`
- devDependencies: `electron-vite`, `vite`, `@vitejs/plugin-react`, `tailwindcss@4`, `@tailwindcss/vite`, `electron-builder`
- `packages/desktop/src/renderer/styles.css` 에 `@theme` 토큰 정의 → 다크 기본 + Linear 톤 색 / radius / 폰트
- 번들 크기 ~ Electron 150 MB + React + Tailwind runtime — personal 도구 맥락에서 수용 가능 (ADR 0010 참조)

## 미래 재검토

- **셋업 마법사 (v0.2)** 진입 시 React Hook Form / Zod 같은 폼 라이브러리 도입 시점에 별도 ADR
- **Tauri 재검토 (번들 크기 이슈 발생 시)** — Tauri 도 React + Tailwind + Radix 그대로 재사용 가능. 셸만 교체. ADR 0010 의 "미래 재검토" 절 따라가면 됨

## 관련 ADR

- ADR 0010 — Electron 채택
- ADR 0011 — monorepo 구조 (packages/desktop 위치)
- ADR 0005 — SemVer / 단계 14 의 PR patch bump, 14.7 단계 완료 minor bump
