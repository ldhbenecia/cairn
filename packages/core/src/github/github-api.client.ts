import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

const CairnOctokit = Octokit.plugin(throttling, retry, restEndpointMethods);
type CairnOctokit = InstanceType<typeof CairnOctokit>;

const GITHUB_REQUEST_TIMEOUT_MS = 20_000;
const MAX_RATE_LIMIT_RETRY_AFTER_SECONDS = 30;

interface RawPrCommit {
  shortSha: string;
  subject: string;
  authoredAt: string;
  authorLogin: string | null;
  isMerge: boolean;
}

export interface SearchPrItem {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  mergedAt: string | null;
  author: string;
  assignees: readonly string[];
  labels: readonly string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GithubApiClient {
  private readonly octokits = new Map<string, CairnOctokit>();
  private readonly loginCache = new Map<string, Promise<string>>();
  private readonly prCommitsCache = new Map<string, Promise<RawPrCommit[]>>();

  constructor(
    @InjectPinoLogger(GithubApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async getAuthenticatedLogin(token: string): Promise<string> {
    const cached = this.loginCache.get(token);
    if (cached) return cached;
    const promise = this.getOctokit(token)
      .rest.users.getAuthenticated()
      .then(({ data }) => data.login);
    this.loginCache.set(token, promise);
    promise.catch(() => this.loginCache.delete(token));
    return promise;
  }

  async searchPrs(token: string, query: string): Promise<SearchPrItem[]> {
    const { data } = await this.getOctokit(token).rest.search.issuesAndPullRequests({
      q: `is:pr ${query}`,
      per_page: 100,
    });
    return data.items.map((item) => {
      const [owner, repo] = parseRepoFromUrl(item.repository_url);
      return {
        owner,
        repo,
        number: item.number,
        title: item.title,
        body: typeof item.body === 'string' ? item.body : null,
        state: normalizeState(item.state),
        mergedAt: item.pull_request?.merged_at ?? null,
        author: item.user?.login ?? 'unknown',
        assignees: (item.assignees ?? []).flatMap((a) => (a?.login ? [a.login] : [])),
        labels: item.labels.flatMap((l) => (typeof l === 'string' ? [l] : l.name ? [l.name] : [])),
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    });
  }

  async listPrCommitsInRange(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
    sinceIso: string,
    untilIso: string,
    authorLogin?: string,
  ): Promise<Array<{ shortSha: string; subject: string; authoredAt: string }>> {
    const all = await this.listPrCommitsCached(token, owner, repo, pullNumber);
    return all
      .filter(
        (c) =>
          !c.isMerge &&
          c.authoredAt >= sinceIso &&
          c.authoredAt <= untilIso &&
          (!authorLogin || !c.authorLogin || c.authorLogin === authorLogin),
      )
      .map(({ shortSha, subject, authoredAt }) => ({ shortSha, subject, authoredAt }));
  }

  private listPrCommitsCached(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<RawPrCommit[]> {
    const key = `${token}:${owner}/${repo}#${pullNumber}`;
    const cached = this.prCommitsCache.get(key);
    if (cached) return cached;
    const promise = this.fetchAllPrCommits(token, owner, repo, pullNumber);
    this.prCommitsCache.set(key, promise);
    promise.catch(() => this.prCommitsCache.delete(key));
    return promise;
  }

  private async fetchAllPrCommits(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<RawPrCommit[]> {
    const octokit = this.getOctokit(token);
    const out: RawPrCommit[] = [];
    let page = 1;
    const perPage = 100;
    // GitHub 가 commit 순서를 author date 로 보장 X — 모두 가져온 뒤 client-side 필터
    while (true) {
      const { data } = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: perPage,
        page,
      });
      for (const c of data) {
        const authorDate = c.commit.author?.date;
        if (!authorDate) continue;
        const subjectFull = c.commit.message ?? '';
        out.push({
          shortSha: c.sha.slice(0, 7),
          subject: subjectFull.split('\n')[0]?.trim() ?? '',
          authoredAt: authorDate,
          authorLogin: c.author?.login ?? null,
          isMerge: c.parents.length > 1,
        });
      }
      if (data.length < perPage) break;
      page += 1;
      if (page > 10) break; // 안전 가드 (PR 에 1000+ commit 은 비정상)
    }
    return out;
  }

  private getOctokit(token: string): CairnOctokit {
    const cached = this.octokits.get(token);
    if (cached) return cached;

    const octokit = new CairnOctokit({
      auth: token,
      userAgent: 'cairn',
      request: { timeout: GITHUB_REQUEST_TIMEOUT_MS },
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          const willRetry = shouldRetryRateLimit(retryAfter, retryCount);
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount, willRetry },
            'github primary rate limit hit',
          );
          return willRetry;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          const willRetry = shouldRetryRateLimit(retryAfter, retryCount);
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount, willRetry },
            'github secondary rate limit hit',
          );
          return willRetry;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
    this.octokits.set(token, octokit);
    this.logger.debug('octokit initialized for token');
    return octokit;
  }
}

function shouldRetryRateLimit(retryAfterSeconds: number, retryCount: number): boolean {
  return retryCount < 1 && retryAfterSeconds <= MAX_RATE_LIMIT_RETRY_AFTER_SECONDS;
}

function parseRepoFromUrl(repositoryUrl: string): [string, string] {
  const match = repositoryUrl.match(/\/repos\/([^/]+)\/([^/]+)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`unexpected repository_url: ${repositoryUrl}`);
  }
  return [match[1], match[2]];
}

function normalizeState(state: string): 'open' | 'closed' {
  return state === 'open' ? 'open' : 'closed';
}
