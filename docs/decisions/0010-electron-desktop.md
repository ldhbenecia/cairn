# 0010. v2 desktop app — Electron 채택

- 상태: accepted
- 작성일: 2026-05-17

## 맥락

v1.x 운영 검증 단계에 진입하면서 (v0.13 까지의 engine 트랙) v2 desktop app 트랙을 시작. roadmap (`docs/plans/2026-05-17-cairn-v2-roadmap.md`) 기준 desktop v0.1 셸부터 차근차근 진행. 첫 결정: GUI 프레임워크.

## 결정

**Electron**.

## 대안

| | Electron | Tauri | SwiftUI 네이티브 |
|---|---|---|---|
| **기존 자산 재사용** | cairn engine TS 코드 거의 그대로 import / spawn | 셸은 Rust, engine 은 Node sidecar | engine ↔ Swift IPC bridge 신설 필요 |
| **개발 학습 곡선** | 0 (TS / React) | 중 (Rust + Tauri API) | 중 (Swift + Apple 도구) |
| **번들 크기** | ~150 MB | ~10 MB | ~5 MB |
| **OS 지원** | macOS / Windows / Linux | macOS / Windows / Linux | macOS only |
| **자동 업데이트** | electron-updater 성숙, 자료 풍부 | tauri-updater 작동 | Apple 정책 의무, 코드 사이닝 / notarization 부담 |
| **시그닝 / 배포** | Apple Developer 계정 권장 (사용자에게 배포 시) | 동일 | Apple Developer 필수 |

## 선택 근거

- **재사용성** — cairn engine 이 NestJS / TS standalone application. Electron 메인 프로세스에서 child_process.spawn 또는 미래에는 in-process import 둘 다 자연스러움. Tauri 도 sidecar 패턴이라 같지만 셸은 Rust 추가 학습이 필요
- **개발 속도** — 본인 백엔드 (NestJS) 배경 + 1 인 개발. TS 만 쓰는 게 학습 + 디버그 최소 비용. v0.1 셸 부터 빠르게 출시
- **번들 크기 단점은 personal 도구 맥락에서 수용 가능** — 일반 사용자가 cairn 을 일반 마켓플레이스에서 다운로드하는 시나리오가 아님. fork / DIY 사용자가 잠재 대상. 150 MB vs 10 MB 의 차이는 결정타가 아님
- **macOS-only 가 아니라 Windows / Linux 도 잠재 시야에 두기 위함** — 회사 환경이 Windows / Linux 일 수 있는 시나리오 대비. SwiftUI 는 macOS 락인 → 향후 옵션 제약
- **로드맵 일관성** — `docs/plans/2026-05-17-cairn-v2-roadmap.md` 의 desktop v0.3 OAuth Device Flow 흐름은 어떤 프레임워크든 가능하지만 Electron 의 `shell.openExternal` / loopback HTTP server 패턴이 가장 직관적

## 결과

- desktop app 코드는 `packages/desktop/` (monorepo, ADR 0011 참조) 에 Electron + TypeScript + (UI 라이브러리는 v0.1 진입 시 결정)
- cairn engine 은 `packages/core/` 그대로. desktop 은 `dist/main.js` 를 child_process 로 spawn (v0.1 ~ v0.2 동안) → 향후 in-process import 검토
- ADR 0002 (portable / 클라우드 X) / ADR 0003 (코드 본문 송신 금지) 정책은 그대로 적용 — Electron 으로 옮겨도 외부 송신 면적 변화 X
- 코드 사이닝 / notarization 은 v1.0 desktop 배포 시점에 별도 결정 (DIY fork 단계에선 불필요)

## 미래 재검토

- 번들 크기 (~150 MB) 가 일반 사용자 배포 시 마찰 → Tauri 재검토. core 가 sidecar 패턴이라 셸 교체는 정도 가능
- macOS 전용 UX 깊이 (메뉴바 / 알림 / 시스템 통합) 가 의미 있게 보이면 SwiftUI 부분 도입 고려 — 현 시점에선 cross-platform 우선
