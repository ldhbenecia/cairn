import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';

export interface DayTotals {
  prCount: number;
  commitCount: number;
}

// 그날 작업 총량 — 발행 진행 모달·요약문·통계가 같은 정의를 쓰도록 한 곳에서 계산.
// prCount = 그날 건드린 전체 PR 수, commitCount = 로컬 + GitHub PR 안 내 커밋의 distinct
// (shortSha 로 중복 제거 — 같은 커밋이 로컬과 PR 양쪽에 잡혀도 한 번만).
export function computeDayTotals(
  github: GithubActivity | null | undefined,
  localGit: LocalGitActivity | null | undefined,
): DayTotals {
  const shas = new Set<string>();
  for (const pr of github?.prs ?? []) {
    for (const c of pr.commitsOnDate) shas.add(c.shortSha);
  }
  for (const repo of localGit?.repos ?? []) {
    for (const c of repo.commits) shas.add(c.shortSha);
  }
  return { prCount: github?.prs.length ?? 0, commitCount: shas.size };
}
