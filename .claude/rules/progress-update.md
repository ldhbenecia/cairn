# PROGRESS.md 갱신 규칙

## 언제 갱신하나

- **단계 시작 시**: 해당 단계의 sub-task가 시작됨을 표시 (`- [ ]` → `- [-]` 또는 그냥 진행 중 표시)
- **sub-task 완료 시**: `- [ ]` → `- [x]`
- **단계 전체 완료 시**: 단계 헤더 옆에 ✅ + 완료 일자 (YYYY-MM-DD KST), 다음 단계로 명시적으로 이동

## 어떻게 갱신하나

1. `docs/PROGRESS.md` 파일을 직접 수정
2. **갱신은 별도 commit**으로 (한 PR의 마지막 커밋이 PROGRESS 업데이트가 되는 패턴이 자연스러움)
3. 메시지: `docs(progress): mark stage N <짧은 설명>`
   - 예: `docs(progress): complete stage 0 (repo scaffold)`

## 형식 (예시)

```markdown
# PROGRESS

## 단계 0: 레포 + 문서 + 품질 도구 셋업 ✅ (2026-04-26)
- [x] git init + 디렉토리 트리
- [x] pnpm + TypeScript
- [x] ESLint + Prettier
- [x] Husky + commitlint + lint-staged
- [x] VSCode 설정
- [x] CLAUDE.md + .claude/rules
- [x] docs/plan.md + PROGRESS.md
- [x] ADR 0001-0005
- [x] PR template
- [x] README scaffold
- [x] develop 브랜치

## 단계 1: NestJS 스켈레톤 + GitHub 수집 (진행 중)
- [ ] nest 베이스 셋업 (수동, NestJS 공식 컨벤션 따라)
- [ ] GithubApiClient (Octokit 래퍼)
- [ ] GithubCollectorService (4 search queries)
- [ ] dry-run CLI
```

## 안 하는 것

- 진행 중 sub-task의 자세한 상태/이슈 적기 (그건 `docs/notes/`에)
- 한 번에 묶어서 며칠치 갱신하기 (sub-task 완료마다 즉시 갱신, 가끔 잊어도 같은 PR 안에선 정리)
