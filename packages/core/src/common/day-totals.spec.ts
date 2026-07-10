import { describe, expect, it } from 'vitest';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import { computeDayTotals } from './day-totals.js';

const gh = (prShas: string[][], accounts?: string[]): GithubActivity =>
  ({
    prs: prShas.map((shas, i) => ({
      account: accounts?.[i] ?? 'Personal',
      commitsOnDate: shas.map((s) => ({ shortSha: s })),
    })),
  }) as unknown as GithubActivity;

const local = (repoShas: string[][]): LocalGitActivity =>
  ({
    repos: repoShas.map((shas) => ({ commits: shas.map((s) => ({ shortSha: s })) })),
  }) as unknown as LocalGitActivity;

describe('computeDayTotals', () => {
  it('prCount = 그날 건드린 전체 PR 수', () => {
    expect(computeDayTotals(gh([['a'], ['b'], []]), null).prCount).toBe(3);
  });

  it('commit 은 로컬+PR 커밋을 shortSha 로 중복 제거', () => {
    // 같은 커밋(a1,a2)이 로컬과 PR 양쪽에 — 4가 아니라 3
    const github = gh([['a1', 'a2', 'b1']]);
    const localGit = local([['a1', 'a2']]);
    expect(computeDayTotals(github, localGit).commitCount).toBe(3);
  });

  it('겹치지 않으면 단순 합', () => {
    expect(computeDayTotals(gh([['a']]), local([['b'], ['c']])).commitCount).toBe(3);
  });

  it('local %h(8자) 와 GitHub slice(7자) 길이 불일치도 같은 커밋으로 dedup', () => {
    // 같은 커밋: GitHub 은 'abc1234'(7), local 은 'abc12345'(8) — 7자 정규화로 1건
    const github = gh([['abc1234']]);
    const localGit = local([['abc12345']]);
    expect(computeDayTotals(github, localGit).commitCount).toBe(1);
  });

  it('빈 입력', () => {
    expect(computeDayTotals(null, null)).toEqual({ prCount: 0, commitCount: 0, byAccount: {} });
  });

  it('byAccount — 계정별 PR 수 + 그 계정 커밋 distinct', () => {
    const github = gh([['a', 'b'], ['c'], ['d']], ['Work', 'Work', 'Personal']);
    const { byAccount } = computeDayTotals(github, null);
    expect(byAccount).toEqual({
      Work: { prCount: 2, commitCount: 3 },
      Personal: { prCount: 1, commitCount: 1 },
    });
  });
});
