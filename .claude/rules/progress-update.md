# Progress 일지 작성 규칙

## 위치 / 파일명

- 디렉토리: `docs/progress/` (디렉토리 자체가 인덱스 — README에 일지 한 줄씩 모으지 않는다)
- README: `docs/progress/README.md` (단계별 진행률 표만 둠 + 작성 규칙)
- 일지 파일: `docs/progress/YYYY-MM-DD-<slug>.md` (KST 기준)
  - slug는 작업 주제, kebab-case (예: `repo-scaffold`, `github-collector`, `debug-husky`, `agent-harness-design`, `notion-publisher`, `auth-redesign`)
  - 한 날에 여러 작업이면 여러 파일 OK

## 언제 작성하나

- **작업 시작 시**: 새 일지 파일 생성 (README는 건드리지 않음)
- **sub-task 완료 시**: 해당 일지의 "완료" 섹션에 즉시 추가
- **단계 전체 완료 시**: README의 진행률 표 갱신 (✅ + 완료 일자) + `package.json` version bump + main으로 PR 머지

## 일지 파일 형식 (예시)

```markdown
# YYYY-MM-DD — <slug>

> 진행 단계: **N — <단계 제목>** (시작 / 진행 중 / 마무리)
> 상태: 진행 중 | 완료

## 완료
- ...

## 진행 중
- ...

## 시행착오 / 결정
- ...
- 비자명한 결정은 별도 ADR(`docs/decisions/`)로도 옮김

## 다음
- ...
```

## 갱신 commit

- `docs(progress): YYYY-MM-DD-<slug>` (새 일지 생성)
- `docs(progress): update <slug>` (기존 일지 갱신)
- `docs(progress): mark stage N complete` (단계 완료, README 진행률 표 + 일지 갱신)

## 중복 방지

- 같은 slug를 한 날에 두 번 만들지 말 것 (이어쓰기)
- 다른 작업이면 다른 slug

## ADR과의 관계

- 일지의 "시행착오 / 결정"은 그날의 흐름·맥락 기록 (왜 그 시점에 그렇게 결정했는지)
- 그중 **장기적으로 살아남을 결정**은 ADR로 옮김 (`docs/decisions/NNNN-<slug>.md`)
- 일지에서 ADR을 참조: `→ ADR 0006`
