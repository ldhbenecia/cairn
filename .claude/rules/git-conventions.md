# Git / 커밋 / PR 컨벤션

## 브랜치 (GitHub Flow — ADR 0006)

- `main` 단일 트렁크. 직접 push 금지
- 작업 브랜치: `feature/<slug>`, `fix/<slug>`, `refactor/<slug>`, `docs/<slug>`, `chore/<slug>` (prefix 풀네임)
- 흐름: main → 분기 → PR(target: main) → 머지 → 로컬 main pull. 브랜치는 머지 후 **삭제하지 않고 보관**(이력 추적)
- 머지 정책: **merge commit** (ADR 0007). rebase merge / squash X. `git log --first-parent main` 으로 PR 단위 훑기

## 커밋 (Conventional Commits)

- 형식·type 검증: `./scripts/commit-msg.sh` 가 소유 (아래 "스크립트로 고정 포맷 생성"). 여기선 판단(scope·톤·body)만 다룸
- scope 예: `github`, `local-git`, `notion`(발행/출력만 — 수집 소스는 2026-06-03 제거), `summarizer`, `rollup`, `state`, `ops`, `config`, `repo`, `release`, `desktop`, `core`
- **subject 톤**: 한국어 명사구 우선. 영어 명령형 동사(`add`, `update`) 가능하면 피함
  - 좋음: `feat(github): GithubCollectorService — 4 search queries + dedup`
  - 피함: `feat(github): add github collector`
- **body 톤**: 반드시 bullet (`- `). 일반 문장 단락 X
  - 한 줄에 한 변경/이유. 읽는 쪽이 훑기 쉽게
- WHY 를 적음. WHAT 은 diff 가 말해줌
- footer: `Refs:`, `Closes #N`, `BREAKING CHANGE:`
- **Co-Authored-By 트레일러**: Claude 가 만든 커밋이면 붙여도 OK, 안 붙여도 OK (강제 아님). 일관성보다는 그때그때 자연스럽게

## 의미 단위 커밋

- 한 PR 안에서도 커밋은 의미 단위로 잘게. **"한 PR = 한 커밋" 금지**
- 한 커밋 = 한 가지 변경 + 빌드/테스트가 깨지지 않는 상태
- 좋은 분할 예 (PR "feat: GitHub collector"):
  1. `chore(github): octokit + plugin 의존`
  2. `feat(github): GithubApiClient — throttling + retry`
  3. `feat(contracts): GithubActivity 화이트리스트 타입`
  4. `feat(github): GithubCollectorService — 4 search queries`
  5. `docs(progress): mark stage 1 ✅`
- 피함: `feat(github): everything for github collector`

## PR

- 제목도 Conventional Commits 형식 (`Stage 0:` 같은 형식 X)
- 본문은 [.github/pull_request_template.md](../../.github/pull_request_template.md) 양식 그대로 (체크리스트 빠뜨리지 말 것)
- PR 단위: 한 PR 은 한 가지 일. 리뷰 30 분 이내 사이즈
- 버전은 ADR 0020 기준 — **patch 기본**(버그/성능/리팩토링/작은 개선), 체감 기능 묶음당 **minor 1회**, docs/CI 만이면 무 bump. 릴리스는 배포 시점에 태그 푸시 (태그 == root version)
- PR 직렬화: 다음 작업은 직전 PR 머지 후 시작

## 스크립트로 고정 포맷 생성

기계적인 형식(제목 포맷·type 검증·precommit)은 룰을 재서술하지 말고 스크립트를 실행한다 (단일 출처).

- 커밋 제목: `./scripts/commit-msg.sh <type> <scope> <subject...>` → `type(scope): subject`. type 유효성 검증 포함
- PR 제목: `./scripts/pr-title.sh <type> <scope> <title...>` (commit-msg 에 위임)
- 커밋 전 정리: `git add` 후 `./scripts/precommit.sh` — 스테이지된 `.ts/.tsx` 에 prettier + eslint --fix, 자동 수정 불가 에러는 차단
- scope·subject·body·버전 bump 같은 **판단**은 위 룰대로 직접 결정한다 (스크립트는 형식만 보장)
