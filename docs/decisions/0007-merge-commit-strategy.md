# 0007. PR 머지 정책 — merge commit 사용

- 상태: accepted
- 작성일: 2026-04-26

## 맥락

원래 plan(`docs/plans/2026-04-26-cairn-overall.md` "Git / PR 워크플로우" 섹션) 과 CLAUDE.md "커밋 / PR 컨벤션" 섹션은 머지 정책으로 **rebase merge** 를 권장했다 (잘 쪼갠 커밋을 main 히스토리에 그대로 보존, linear history).

그러나 실제 운용에서는 PR #1 ~ #4 모두 GitHub UI 의 **"Create a merge commit"** 으로 머지됐다. 단계 1 첫 PR(#4) 머지 직후 이 차이를 인지하고 정책을 명시적으로 정리하기로 함.

ADR 0006(GitHub Flow)은 브랜치 전략에 한정되어 있고 머지 방식은 명시하지 않으므로, 본 ADR은 **0006을 supersede 하지 않고** 머지 방식만 새로 정한다.

## 결정

**PR 머지는 GitHub "Create a merge commit" 사용.**

- 모든 PR 머지는 merge commit 으로 (`Merge pull request #N from ...` 메타 commit + PR 안의 개별 commit 들이 부모 라인에 보존됨).
- `--ff-only` / squash / rebase merge 사용 금지.
- main 히스토리는 first-parent 가 PR 단위, second-parent 가 그 PR 안의 잘게 쪼갠 commit 들이 됨.
- PR 단위 훑기: `git log --first-parent main` (PR 1개 = 한 줄).
- 그 안의 세부 커밋 보기: `git log main` (전체 트리).

## 대안

- **A. rebase merge (원래 plan)** — main 히스토리 linear, but PR 경계가 흐려져 "이게 어느 PR에서 들어왔는지" 추적이 commit 단위로만 가능. 1인 도구라 git bisect 의 빈도도 낮아 linear 의 이점 적음.
- **B. squash merge** — PR 1개 = main commit 1개. 가장 깔끔해 보이지만 PR 안의 commit 분할(scope/type 별로 의미 단위) 노력이 사라짐. 본 프로젝트는 잘게 쪼갠 commit 자체에 가치 둠 (plan 31-42행).
- **C. merge commit (이 결정)** — PR 단위와 commit 단위 둘 다 보존. `git log --first-parent` 로 PR 단위, 일반 `git log` 로 세부 단위. 단점은 main 히스토리가 비선형이 되어 일부 도구(예: 단순 `git log --oneline`) 에서 시각적 노이즈.

## 결과

- **장점**:
  - PR 단위 응집이 main 히스토리에 명시적으로 표현됨 (merge commit 1개 = PR 1개)
  - `git log --first-parent main` 으로 "지금까지 머지된 PR 목록"을 한 줄씩 훑기 가능
  - 잘게 쪼갠 commit 도 그대로 보존
  - GitHub UI 기본 옵션 그대로 → 머지 시 실수 가능성 낮음
- **트레이드오프**:
  - main 히스토리가 비선형이라 `git log --oneline` 출력이 길어짐
  - revert 시 merge commit 단위로 되돌리기 (`git revert -m 1 <merge-sha>`) — 일반 commit revert 보다 한 단계 더
- **후속 정리**:
  - CLAUDE.md "커밋 / PR 컨벤션" 머지 정책 줄을 "merge commit" 으로 수정 + ADR 0007 참조
  - `docs/plans/2026-04-26-cairn-overall.md` "Git / PR 워크플로우" 섹션의 "rebase merge" 문구 갱신
  - GitHub repo Settings → "Pull Requests" 에서 "Allow merge commits" 만 활성, rebase/squash 비활성 (수동, 권장)

## 관련

- ADR 0006: GitHub Flow (브랜치 전략) — 본 ADR이 supersede 하지 않음
- 단계 1 첫 PR(#4) 머지 직후 결정
