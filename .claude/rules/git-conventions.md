# Git / 커밋 / PR 컨벤션

## 브랜치 (GitHub Flow)

- `main` 직접 push 금지. 작업 브랜치 prefix 는 풀네임: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`
- 브랜치는 머지 후 삭제하지 않고 보관 (이력 추적)
- 머지는 merge commit 만. rebase·squash X — `git log --first-parent main` 으로 PR 단위를 훑기 때문

## 커밋

- 형식·type 검증은 `./scripts/commit-msg.sh <type> <scope> <subject...>`, PR 제목은 `./scripts/pr-title.sh`. 커밋 전 `git add` 후 `./scripts/precommit.sh`
- `notion` scope 는 발행/출력만 (수집 소스는 제거됨)
- subject 는 한국어. 영어 명령형 동사(`add`, `update`) 피함
- body 는 bullet (`- `) 만, 한 줄에 한 변경/이유. WHY 를 적음
- footer: `Refs:`, `Closes #N`, `BREAKING CHANGE:`. Co-Authored-By 는 선택
- 한 PR 안에서도 의미 단위로 잘게 커밋 ("한 PR = 한 커밋" 금지). 각 커밋은 빌드/테스트가 깨지지 않는 상태

## PR

- 제목도 Conventional Commits 형식
- 본문은 [.github/pull_request_template.md](../../.github/pull_request_template.md) 양식 그대로 (체크리스트 포함)
- 버전: patch 기본(버그/성능/리팩토링/작은 개선), 체감 기능 묶음당 minor 1회 (PR 당 X), docs/CI 만이면 bump 없음. 릴리스는 배포 시점에 태그 푸시 (태그 == root version)
- PR 직렬화: 다음 작업은 직전 PR 머지 후 시작
