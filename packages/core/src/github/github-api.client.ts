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

export interface GithubIdentity {
  login: string;
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
  labels: readonly string[];
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GithubApiClient {
  private readonly octokits = new Map<string, CairnOctokit>();

  constructor(
    @InjectPinoLogger(GithubApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async healthCheck(token: string): Promise<GithubIdentity> {
    const { data } = await this.getOctokit(token).rest.users.getAuthenticated();
    return { login: data.login };
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
        labels: item.labels.flatMap((l) => (typeof l === 'string' ? [l] : l.name ? [l.name] : [])),
        htmlUrl: item.html_url,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    });
  }

  async listPrFileBasenames(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<string[]> {
    const { data } = await this.getOctokit(token).rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return data.map((f) => basename(f.filename));
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
    const octokit = this.getOctokit(token);
    const out: Array<{ shortSha: string; subject: string; authoredAt: string }> = [];
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
        const author = c.commit.author;
        const authorDate = author?.date;
        if (!authorDate) continue;
        if (authorDate < sinceIso || authorDate > untilIso) continue;
        if (c.parents.length > 1) continue;
        if (authorLogin && c.author?.login && c.author.login !== authorLogin) continue;
        const subjectFull = c.commit.message ?? '';
        const subject = subjectFull.split('\n')[0]?.trim() ?? '';
        out.push({
          shortSha: c.sha.slice(0, 7),
          subject,
          authoredAt: authorDate,
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

function basename(path: string): string {
  const last = path.split('/').pop();
  return last ?? path;
}
