import { describe, expect, it } from 'vitest';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type { GithubActivity } from '../contracts/github-activity.types.js';
import type { LocalGitActivity } from '../contracts/local-git-activity.types.js';
import type { NotionActivity } from '../contracts/notion-activity.types.js';
import { buildActivityPayload, type SummarizerInput } from './summarizer-tools.js';

const githubActivity: GithubActivity = {
  date: '2026-05-09',
  rangeStart: '2026-05-08T15:00:00Z',
  rangeEnd: '2026-05-09T14:59:59Z',
  prs: [
    {
      account: 'personal',
      repo: 'cairn',
      number: 13,
      title: 'refactor(common): CairnError 통합',
      state: 'merged',
      author: 'me',
      labels: [],
      htmlUrl: 'https://github.com/x/cairn/pull/13',
      createdAt: '2026-05-09T01:00:00Z',
      updatedAt: '2026-05-09T05:00:00Z',
      mergedAt: '2026-05-09T05:00:00Z',
      changedFileNames: ['error.ts'],
      categories: ['authored', 'authored_merged'],
      body: 'CairnError class + ErrorSource/ErrorCode enum 통합',
    },
    {
      account: 'personal',
      repo: 'cairn',
      number: 14,
      title: 'feat(notion): worklog DB schema',
      state: 'open',
      author: 'me',
      labels: ['feat'],
      htmlUrl: 'https://github.com/x/cairn/pull/14',
      createdAt: '2026-05-09T06:00:00Z',
      updatedAt: '2026-05-09T07:00:00Z',
      mergedAt: null,
      changedFileNames: ['schema.ts'],
      categories: ['authored'],
      body: null,
    },
  ],
};

const localGitActivity: LocalGitActivity = {
  date: '2026-05-09',
  rangeStart: '2026-05-08T15:00:00Z',
  rangeEnd: '2026-05-09T14:59:59Z',
  repos: [
    {
      repo: 'cairn',
      commitCount: 2,
      commits: [
        {
          shortSha: 'abc1234',
          subject: 'feat(summarizer): tools',
          authoredAt: '2026-05-09T05:00:00+09:00',
          branch: 'feature/summarizer-daily',
          pushed: true,
        },
        {
          shortSha: 'def5678',
          subject: 'wip: agent loop',
          authoredAt: '2026-05-09T07:00:00+09:00',
          branch: 'feature/summarizer-daily',
          pushed: false,
        },
      ],
    },
  ],
};

const notionActivity: NotionActivity = {
  date: '2026-05-09',
  rangeStart: '2026-05-08T15:00:00Z',
  rangeEnd: '2026-05-09T14:59:59Z',
  workspaces: [
    {
      workspace: 'personal',
      pageCount: 1,
      pages: [
        {
          id: '35b4fa8f-67dd-80f0-9616-c6b1d18c7be9',
          title: '오늘의 작업 메모',
          url: 'https://www.notion.so/Note-abc123',
          lastEditedAt: '2026-05-09T03:00:00Z',
          parentType: 'page_id',
        },
      ],
    },
  ],
};

describe('buildActivityPayload', () => {
  it('builds expected shape with all 3 sources', () => {
    const input: SummarizerInput = {
      date: '2026-05-09',
      github: githubActivity,
      localGit: localGitActivity,
      notion: notionActivity,
    };
    const payload = buildActivityPayload(input);

    expect(payload.date).toBe('2026-05-09');
    expect(payload.done.prs).toHaveLength(1);
    expect(payload.done.prs[0]?.kind).toBe('pr_merged');
    expect(payload.done.commits).toHaveLength(1);
    expect(payload.done.commits[0]?.kind).toBe('commit_pushed');
    expect(payload.inProgress.prs).toHaveLength(1);
    expect(payload.inProgress.prs[0]?.kind).toBe('pr_open');
    expect(payload.inProgress.commits).toHaveLength(1);
    expect(payload.inProgress.commits[0]?.kind).toBe('commit_unpushed');
    expect(payload.notes).toHaveLength(1);
    expect(payload.sourceErrors).toEqual({});
  });

  it('payload has no forbidden patterns (redaction)', () => {
    const input: SummarizerInput = {
      date: '2026-05-09',
      github: githubActivity,
      localGit: localGitActivity,
      notion: notionActivity,
    };
    const payload = buildActivityPayload(input);
    expect(() => assertNoForbiddenPayload(payload, 'test.full')).not.toThrow();
  });

  it('handles all-null input (no enabled sources)', () => {
    const input: SummarizerInput = {
      date: '2026-05-09',
      github: null,
      localGit: null,
      notion: null,
    };
    const payload = buildActivityPayload(input);
    expect(payload.done.prs).toEqual([]);
    expect(payload.done.commits).toEqual([]);
    expect(payload.inProgress.prs).toEqual([]);
    expect(payload.inProgress.commits).toEqual([]);
    expect(payload.notes).toEqual([]);
    expect(payload.sourceErrors).toEqual({});
  });
});
