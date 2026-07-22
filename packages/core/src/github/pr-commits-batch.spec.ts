import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { GithubApiClient } from './github-api.client.js';

const SINCE = '2026-07-01T00:00:00Z';
const UNTIL = '2026-07-31T00:00:00Z';

interface RawPrCommit {
  shortSha: string;
  subject: string;
  authoredAt: string;
  authorLogin: string | null;
  isMerge: boolean;
}

function gqlNode(oid: string, headline: string, date: string, login: string | null, parents = 1) {
  return {
    commit: {
      oid,
      messageHeadline: headline,
      authoredDate: date,
      author: login ? { user: { login } } : null,
      parents: { totalCount: parents },
    },
  };
}

function makeClient() {
  const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() } as unknown as PinoLogger;
  const client = new GithubApiClient(logger);
  const graphql = vi.fn();
  vi.spyOn(
    client as unknown as { getOctokit: (t: string) => unknown },
    'getOctokit',
  ).mockReturnValue({ graphql });
  const restSpy = vi.spyOn(
    client as unknown as {
      fetchAllPrCommits: (
        token: string,
        owner: string,
        repo: string,
        pullNumber: number,
      ) => Promise<RawPrCommit[]>;
    },
    'fetchAllPrCommits',
  );
  return { client, graphql, restSpy };
}

describe('GithubApiClient.primePrCommits — GraphQL alias 배치 선적재', () => {
  it('배치 결과를 캐시에 선적재해 REST 없이 서빙, 매핑·필터 정확', async () => {
    const { client, graphql, restSpy } = makeClient();
    graphql.mockResolvedValue({
      pr0: {
        pullRequest: {
          commits: {
            totalCount: 3,
            nodes: [
              gqlNode('abcdef1234567890', 'add feature', '2026-07-09T01:00:00Z', 'me', 1),
              gqlNode('0000000merge0000', 'merge branch', '2026-07-09T02:00:00Z', 'me', 2),
              gqlNode('fedcba9876543210', 'other work', '2026-07-09T03:00:00Z', 'someoneelse', 1),
            ],
          },
        },
      },
    });

    await client.primePrCommits('tok', [{ owner: 'o', repo: 'r', number: 5 }]);
    const res = await client.listPrCommitsInRange('tok', 'o', 'r', 5, SINCE, UNTIL, 'me');

    expect(graphql).toHaveBeenCalledTimes(1);
    expect(restSpy).not.toHaveBeenCalled();
    // shortSha = oid 앞 7자, subject = headline trim, merge·타 author 는 필터로 제외
    expect(res).toEqual([
      { shortSha: 'abcdef1', subject: 'add feature', authoredAt: '2026-07-09T01:00:00Z' },
    ]);
  });

  it('PR 15개 단위로 chunk — 16개면 GraphQL 2회', async () => {
    const { client, graphql } = makeClient();
    graphql.mockResolvedValue({});
    const refs = Array.from({ length: 16 }, (_, i) => ({ owner: 'o', repo: 'r', number: i + 1 }));

    await client.primePrCommits('tok', refs);

    expect(graphql).toHaveBeenCalledTimes(2);
  });

  it('100 초과 커밋 PR 은 선적재 제외 → REST 폴백', async () => {
    const { client, graphql, restSpy } = makeClient();
    graphql.mockResolvedValue({
      pr0: { pullRequest: { commits: { totalCount: 150, nodes: [] } } },
    });
    restSpy.mockResolvedValue([
      {
        shortSha: 'rest111',
        subject: 'rest commit',
        authoredAt: '2026-07-09T01:00:00Z',
        authorLogin: 'me',
        isMerge: false,
      },
    ]);

    await client.primePrCommits('tok', [{ owner: 'o', repo: 'r', number: 9 }]);
    const res = await client.listPrCommitsInRange('tok', 'o', 'r', 9, SINCE, UNTIL, 'me');

    expect(restSpy).toHaveBeenCalledTimes(1);
    expect(res).toEqual([
      { shortSha: 'rest111', subject: 'rest commit', authoredAt: '2026-07-09T01:00:00Z' },
    ]);
  });

  it('접근 불가 PR(pullRequest null)은 선적재 제외 → REST 폴백', async () => {
    const { client, graphql, restSpy } = makeClient();
    graphql.mockResolvedValue({ pr0: { pullRequest: null } });
    restSpy.mockResolvedValue([]);

    await client.primePrCommits('tok', [{ owner: 'o', repo: 'r', number: 3 }]);
    await client.listPrCommitsInRange('tok', 'o', 'r', 3, SINCE, UNTIL, 'me');

    expect(restSpy).toHaveBeenCalledTimes(1);
  });

  it('GraphQL 전체 에러(data 없음)면 chunk 전체 REST 폴백', async () => {
    const { client, graphql, restSpy } = makeClient();
    graphql.mockRejectedValue(new Error('boom'));
    restSpy.mockResolvedValue([]);

    await client.primePrCommits('tok', [{ owner: 'o', repo: 'r', number: 1 }]);
    await client.listPrCommitsInRange('tok', 'o', 'r', 1, SINCE, UNTIL, 'me');

    expect(restSpy).toHaveBeenCalledTimes(1);
  });

  it('부분 에러(err.data 있음)면 resolved alias 만 선적재, 나머지는 REST', async () => {
    const { client, graphql, restSpy } = makeClient();
    const err = Object.assign(new Error('partial'), {
      data: {
        pr0: {
          pullRequest: {
            commits: {
              totalCount: 1,
              nodes: [gqlNode('deadbeef00000000', 'partial ok', '2026-07-09T01:00:00Z', 'me', 1)],
            },
          },
        },
        pr1: null,
      },
    });
    graphql.mockRejectedValue(err);

    await client.primePrCommits('tok', [
      { owner: 'o', repo: 'r', number: 1 },
      { owner: 'o', repo: 'r', number: 2 },
    ]);
    const served = await client.listPrCommitsInRange('tok', 'o', 'r', 1, SINCE, UNTIL, 'me');

    expect(restSpy).not.toHaveBeenCalled();
    expect(served).toEqual([
      { shortSha: 'deadbee', subject: 'partial ok', authoredAt: '2026-07-09T01:00:00Z' },
    ]);
  });

  it('이미 캐시된 PR 은 재선적재하지 않음 (중복 GraphQL 없음)', async () => {
    const { client, graphql } = makeClient();
    graphql.mockResolvedValue({
      pr0: {
        pullRequest: {
          commits: {
            totalCount: 1,
            nodes: [gqlNode('abcdef1234567890', 'x', '2026-07-09T01:00:00Z', 'me', 1)],
          },
        },
      },
    });
    const ref = { owner: 'o', repo: 'r', number: 5 };

    await client.primePrCommits('tok', [ref]);
    graphql.mockClear();
    await client.primePrCommits('tok', [ref]);

    expect(graphql).not.toHaveBeenCalled();
  });
});
