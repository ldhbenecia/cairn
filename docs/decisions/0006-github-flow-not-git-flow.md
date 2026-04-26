# 0006. GitHub Flow (main + 작업 브랜치) 채택 — Git Flow의 develop 폐기

- 상태: accepted (supersedes part of 0001-introduced workflow)
- 작성일: 2026-04-26

## 맥락

단계 0에서는 plan에 따라 main + develop 두 브랜치 + feature 브랜치(선택) 구조의 Git Flow lite를 시작했다. 단계 0 PR(develop → main)을 머지한 직후 사용자가 의문을 제기:

> develop 브랜치를 굳이 거칠 이유가 있나 싶음. 그냥 develop에서 작업하고 PR 쓰는 게 나아 보이고, 또는 작업마다 브랜치 파는 게 나으려나?

cairn은 한 사람이 만드는 개인 도구다. 릴리즈 컷이나 동시 협업이 없다.

## 결정

**GitHub Flow 채택. develop 브랜치 폐기.**

- `main`이 단일 트렁크.
- 모든 작업은 `main`에서 작업 브랜치를 파서 진행: `feature/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, `chore/<slug>` (prefix는 풀네임).
- 작업 브랜치 → main PR → 머지 → 브랜치 삭제 → main pull.
- main 직접 push 금지.
- PR 제목은 Conventional Commits 형식 (`type(scope): 한국어 주제`).

## 대안

- **A. develop 유지 (Git Flow lite)** — 팀/릴리즈 분리에는 좋지만, 1인 개인 도구에선 ceremony 비용. develop이 main과 거의 항상 동기화되어 두 번 PR 만드는 격.
- **B. develop만 사용 (브랜치 분리 X)** — 가장 가볍지만 PR 자체를 못 씀(자기 자신과 PR 불가). 검토·격리·이력 추적 신호 잃음.
- **C. trunk-based development (브랜치 없이 main에 직접 push)** — 가장 단순하지만 lint/test 강제·실수 회복성·이력 신호가 약해짐.

## 결과

- **장점**:
  - 한 layer 제거 (develop)
  - PR마다 격리 + 머지 후 브랜치 삭제로 이력 깔끔
  - main은 항상 안정 (PR 통과 = 안정)
- **트레이드오프**:
  - 매번 작업 브랜치 만들어야 함 (한 줄 비용)
  - 동시에 여러 작업 진행 시 충돌 가능 — 단계별 작업이라 거의 발생 안 함
- **단계 0의 흔적**: PR #1은 develop → main으로 진행됐음. 이후엔 모두 작업 브랜치 → main 패턴.

## 강제 / 후속 작업

1. develop 브랜치 삭제 (로컬 + remote) ✅
2. CLAUDE.md, .claude/rules, plan, PR template의 develop 언급 제거 → 이 ADR을 만든 PR에서 같이
3. main에 branch protection 권장 (수동, GitHub Settings)

## 관련

- 단계 0 PR: https://github.com/ldhbenecia/cairn/pull/1 (이 결정을 촉발한 시점)
- 처음 plan의 워크플로우 섹션: `docs/plans/2026-04-26-cairn-overall.md` "Git / PR 워크플로우"
