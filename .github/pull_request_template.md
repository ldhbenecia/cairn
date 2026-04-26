## Summary

<!-- 무엇을 / 왜. 한두 문장. -->

## Changes

<!-- 커밋이 잘 쪼개져 있다면 git log로 충분, 보충이 필요하면 bullets -->

-
-

## Test plan

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm test` 통과
- [ ] (해당 시) `node dist/main.js --mode=... --dry-run` 검증

## Checklist

- [ ] PR 제목이 Conventional Commits 형식: `type(scope): 한국어 주제`
- [ ] 커밋이 의미 단위로 잘게 분할됨
- [ ] `package.json` version bump (단계 완료 PR은 minor, 그 외 patch — ADR 0005)
- [ ] `docs/progress/` 일지 갱신, 단계 완료 시 진행률 표도 갱신
- [ ] 비자명한 결정은 ADR 추가, 외부 송신·민감정보 검토 (ADR 0003)

## Related (해당 시)

- 일지: `docs/progress/<file>.md`
- ADR: `docs/decisions/NNNN-<slug>.md`
- Issue: #N
