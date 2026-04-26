# 2026-04-26 — adr merge policy

> 진행 단계: **단계 1 사이 메타** (단계 1 첫 PR #4 머지 직후)
> 상태: 완료

## 완료

- ADR 0007 추가 — PR 머지 정책을 **merge commit** 으로 명시
- ADR 0006 supersede X (0006은 브랜치 전략만, 머지 방식은 미명시였음)
- CLAUDE.md "커밋 / PR 컨벤션" 머지 정책 줄 갱신 (rebase merge → merge commit, ADR 0007 참조)
- `docs/plans/2026-04-26-cairn-overall.md` "Git / PR 워크플로우" 머지 정책 줄 갱신
- patch bump `0.1.3 → 0.1.4`

## 시행착오 / 결정

- 원래 plan/CLAUDE.md는 rebase merge 권장이었으나 PR #1~#4 모두 merge commit 으로 머지됨. 차이를 인지한 시점에 **실제 운용을 정책으로 채택**, ADR 0007로 박음.
- ADR 0006 supersede 안 함 — 0006은 GitHub Flow(브랜치 전략)만 다루고 머지 방식 언급 없음.
- merge commit 의 이점: PR 단위 응집을 main 히스토리에 그대로 표현. `git log --first-parent main` 으로 PR 단위 한 줄씩 훑기 가능. revert 도 PR 단위(`git revert -m 1`).

## 다음

- `feature/github-client` PR — Octokit + `@octokit/plugin-throttling` + `@octokit/plugin-retry` 래퍼
