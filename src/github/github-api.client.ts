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
