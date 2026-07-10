import { describe, expect, it } from 'vitest';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import { collectSourceErrors, computeDayTotals } from './day-totals.js';
import { CairnError, ErrorCode, ErrorSource } from './error.js';

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

describe('collectSourceErrors', () => {
  const authError = new CairnError(
    ErrorSource.Github,
    ErrorCode.AuthFailed,
    'Bad credentials',
    401,
  );
  const repoError = new CairnError(ErrorSource.LocalGit, ErrorCode.NotFound, 'repo path missing');

  it('github accountErrors 를 계정 라벨과 함께 수집', () => {
    const github = {
      prs: [],
      accountErrors: [{ account: 'Work', error: authError }],
    } as unknown as GithubActivity;
    expect(collectSourceErrors(github, null)).toEqual([
      { source: 'github', label: 'Work', error: authError },
    ]);
  });

  it('local-git repo 별 error 를 repo 라벨과 함께 수집', () => {
    const localGit = {
      repos: [
        { repo: 'cairn', commits: [], error: repoError },
        { repo: 'other', commits: [] },
      ],
    } as unknown as LocalGitActivity;
    expect(collectSourceErrors(null, localGit)).toEqual([
      { source: 'local-git', label: 'cairn', error: repoError },
    ]);
  });

  it('에러 없으면 빈 배열 — 진짜 무활동과 구분의 기준', () => {
    const github = { prs: [] } as unknown as GithubActivity;
    const localGit = { repos: [{ repo: 'cairn', commits: [] }] } as unknown as LocalGitActivity;
    expect(collectSourceErrors(github, localGit)).toEqual([]);
    expect(collectSourceErrors(null, null)).toEqual([]);
  });
});
