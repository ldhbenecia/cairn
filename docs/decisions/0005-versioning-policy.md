# 0005. SemVer + 단계별 minor bump + PR 단위 patch bump

- 상태: accepted
- 작성일: 2026-04-26

## 맥락

cairn은 단계 0~8을 점진적으로 거치며 v1.0.0(첫 stable)에 도달한다. 각 PR이 머지될 때마다 `package.json`의 version도 적절히 올리고 싶음 (변경 추적 + 릴리즈 신호).

## 결정

**Semantic Versioning** + 다음 매핑:

| 변경 유형 | bump |
|----------|------|
| 새 단계 완료 (의미 있는 신규 기능 묶음) | minor (0.X.0 → 0.X+1.0) |
| 같은 단계 안의 fix / refactor / chore | patch (0.X.Y → 0.X.Y+1) |
| breaking change (공개 인터페이스, env, config 형식) | major (X.0.0) |
| docs only | no bump (또는 patch — 선택) |

### 단계별 시작/종료 버전

- 0단계 시작: `0.0.0`
- 0단계 완료: `0.1.0`
- 1단계 완료: `0.2.0`
- ...
- 8단계 완료 = **첫 stable**: `1.0.0`

### 운영

- PR 머지 직전에 `package.json`의 version을 수동으로 bump (별도 commit `chore(release): bump to 0.X.Y`)
- 단계 완료 시점은 `docs/progress/README.md` 진행률 표 갱신과 같은 PR에 묶음
- v1.0.0 이후엔 일반 SemVer 흐름: feat → minor, fix → patch, breaking → major

## 대안

- **A. release-please / changesets로 자동화** — Conventional Commits를 읽어 자동 bump + CHANGELOG 생성. 단 v1 이전엔 과함, GitHub Actions(=CI 비용)도 필요
- **B. 버전 관리 안 함 (private 도구)** — 가능하지만 진행 추적 신호 잃음
- **C. 커밋마다 patch bump** — 잘게 쌓이는 커밋이 많아서 노이즈 ↑

## 결과

- **장점**: 단계 진행이 버전에 명확히 반영. v1.0.0이 첫 stable이라는 신호 명확.
- **트레이드오프**: 수동 관리 → 잊을 위험. PR template 체크리스트에 "version bump"를 두어 대응.
- **자동화 시점**: v1.0.0 이후 release-please 도입 검토 (별도 ADR 0006+)

## 관련

- PR template 체크리스트: `.github/pull_request_template.md` (단계 0 commit 8에서 추가)
- 단계별 시작/종료 버전 표기: `docs/progress/README.md` 진행률 표
