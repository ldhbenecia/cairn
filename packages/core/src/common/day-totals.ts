import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';

export interface AccountTotals {
  prCount: number;
  commitCount: number;
}

export interface DayTotals {
  prCount: number;
  commitCount: number;
  // GitHub 계정 라벨(Work/Personal 등)별 PR 수 + 그 계정 PR 안 커밋 distinct
  // 로컬 커밋은 계정이 없어 전체(commitCount)에만 반영, byAccount 미포함
  byAccount: Record<string, AccountTotals>;
}

// commitCount = 로컬 + GitHub PR 안 내 커밋의 distinct
// (shortSha 로 중복 제거 — 같은 커밋이 로컬과 PR 양쪽에 잡혀도 한 번만).
// GitHub 은 sha.slice(0,7) 고정, local-git 은 git %h(가변 — 충돌 시 8자 이상)라 같은 커밋이
// 서로 다른 길이로 잡혀 dedup 이 실패, 이중 집계되던 문제. 공통 7자 prefix 로 정규화.
const shaKey = (s: string): string => s.slice(0, 7);

export function computeDayTotals(
  github: GithubActivity | null | undefined,
  localGit: LocalGitActivity | null | undefined,
): DayTotals {
  const shas = new Set<string>();
  const accounts = new Map<string, { prCount: number; shas: Set<string> }>();
  for (const pr of github?.prs ?? []) {
    let bucket = accounts.get(pr.account);
    if (!bucket) {
      bucket = { prCount: 0, shas: new Set() };
      accounts.set(pr.account, bucket);
    }
    bucket.prCount += 1;
    for (const c of pr.commitsOnDate) {
      shas.add(shaKey(c.shortSha));
      bucket.shas.add(shaKey(c.shortSha));
    }
  }
  for (const repo of localGit?.repos ?? []) {
    for (const c of repo.commits) shas.add(shaKey(c.shortSha));
  }
  const byAccount: Record<string, AccountTotals> = {};
  for (const [acct, b] of accounts) {
    byAccount[acct] = { prCount: b.prCount, commitCount: b.shas.size };
  }
  return { prCount: github?.prs.length ?? 0, commitCount: shas.size, byAccount };
}
