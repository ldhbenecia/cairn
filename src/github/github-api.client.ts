import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/core';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SecretsService } from '../secrets/secrets.service.js';

const CairnOctokit = Octokit.plugin(throttling, retry, restEndpointMethods);
type CairnOctokit = InstanceType<typeof CairnOctokit>;

export interface GithubIdentity {
  login: string;
}

export interface SearchPrItem {
  owner: string;
  repo: string;
  number: number;
  title: string;
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
  private octokit: CairnOctokit | undefined;

  constructor(
    private readonly secrets: SecretsService,
    @InjectPinoLogger(GithubApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async healthCheck(): Promise<GithubIdentity> {
    const { data } = await this.getOctokit().rest.users.getAuthenticated();
    return { login: data.login };
  }

  async searchPrs(query: string): Promise<SearchPrItem[]> {
    const { data } = await this.getOctokit().rest.search.issuesAndPullRequests({
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

  async listPrFileBasenames(owner: string, repo: string, pullNumber: number): Promise<string[]> {
    const { data } = await this.getOctokit().rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return data.map((f) => basename(f.filename));
  }

  private getOctokit(): CairnOctokit {
    if (this.octokit) return this.octokit;

    const token = this.secrets.requireGithubToken();
    this.octokit = new CairnOctokit({
      auth: token,
      userAgent: 'cairn',
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount },
            'github primary rate limit hit',
          );
          return retryCount < 1;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount },
            'github secondary rate limit hit',
          );
          return retryCount < 1;
        },
      },
      retry: {
        doNotRetry: [400, 401, 403, 404, 422],
      },
    });
    this.logger.debug('octokit initialized');
    return this.octokit;
  }
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
