import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type {
  GithubAccountActivityError,
  GithubActivity,
  GithubActivityCategory,
  GithubPrState,
  GithubPrSummary,
} from '../contracts/github-activity.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { GithubAccountConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { kstDateToUtcWindow, searchRangeFragment } from './date-window.js';
import { GithubApiClient, type SearchPrItem } from './github-api.client.js';

const PR_BODY_MAX_CHARS = 800;

interface PrBucket {
  account: string;
  item: SearchPrItem;
  categories: Set<GithubActivityCategory>;
}

@Injectable()
export class GithubCollectorService {
  constructor(
    private readonly client: GithubApiClient,
    private readonly worklogConfig: WorklogConfigService,
    private readonly secrets: SecretsService,
    @InjectPinoLogger(GithubCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(date: string): Promise<GithubActivity> {
    const window = kstDateToUtcWindow(date);
    const range = searchRangeFragment(window);
    const accounts = this.worklogConfig.getGithubAccounts();

    if (accounts.length === 0) {
      this.logger.warn('no githubAccounts configured in worklog.config.json — empty activity');
      return {
        date,
        rangeStart: window.startIso,
        rangeEnd: window.endIso,
        prs: [],
      };
    }

    this.logger.info({ date, range, accountCount: accounts.length }, 'github collect start');

    const settled = await Promise.allSettled(
      accounts.map((account) => this.collectAccount(account, range)),
    );

    const accountErrors: GithubAccountActivityError[] = [];
    const prs: GithubPrSummary[] = [];

    settled.forEach((result, idx) => {
      const account = accounts[idx];
      const label = account?.label ?? 'unknown';
      if (result.status === 'fulfilled') {
        prs.push(...result.value);
      } else {
        const error = CairnError.from(result.reason, 'github');
        this.logger.warn({ account: label, error }, 'github account failed');
        accountErrors.push({ account: label, error });
      }
    });

    this.logger.info(
      { date, prCount: prs.length, accountErrorCount: accountErrors.length },
      'github collect done',
    );

    return {
      date,
      rangeStart: window.startIso,
      rangeEnd: window.endIso,
      prs,
      ...(accountErrors.length > 0 ? { accountErrors } : {}),
    };
  }

  private async collectAccount(
    account: GithubAccountConfig,
    range: string,
  ): Promise<GithubPrSummary[]> {
    const token = this.secrets.getEnv(account.tokenEnv);
    if (!token) {
      throw CairnError.githubTokenMissing(account.tokenEnv);
    }

    const [authored, authoredMerged, reviewed, commented] = await Promise.all([
      this.client.searchPrs(token, `author:@me updated:${range}`),
      this.client.searchPrs(token, `author:@me merged:${range}`),
      this.client.searchPrs(token, `reviewed-by:@me updated:${range}`),
      this.client.searchPrs(token, `commenter:@me updated:${range}`),
    ]);

    const buckets = new Map<string, PrBucket>();
    this.tag(buckets, account.label, authored, 'authored');
    this.tag(buckets, account.label, authoredMerged, 'authored_merged');
    this.tag(buckets, account.label, reviewed, 'reviewed');
    this.tag(buckets, account.label, commented, 'commented');

    return Promise.all([...buckets.values()].map((bucket) => this.toPrSummary(token, bucket)));
  }

  private tag(
    buckets: Map<string, PrBucket>,
    account: string,
    items: SearchPrItem[],
    category: GithubActivityCategory,
  ): void {
    for (const item of items) {
      const key = `${account}/${item.owner}/${item.repo}#${item.number}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.categories.add(category);
      } else {
        buckets.set(key, { account, item, categories: new Set([category]) });
      }
    }
  }

  private async toPrSummary(token: string, bucket: PrBucket): Promise<GithubPrSummary> {
    const { account, item, categories } = bucket;
    const [changedFileNames, body] = await Promise.all([
      this.client.listPrFileBasenames(token, item.owner, item.repo, item.number),
      this.fetchSafeBody(token, item),
    ]);
    return {
      account,
      repo: item.repo,
      number: item.number,
      title: item.title,
      state: deriveState(item),
      author: item.author,
      labels: item.labels,
      htmlUrl: item.htmlUrl,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      mergedAt: item.mergedAt,
      changedFileNames,
      categories: [...categories],
      body,
    };
  }

  private async fetchSafeBody(token: string, item: SearchPrItem): Promise<string | null> {
    let raw: string | null;
    try {
      raw = await this.client.fetchPrBody(token, item.owner, item.repo, item.number);
    } catch (err) {
      this.logger.warn(
        { repo: item.repo, number: item.number, err: CairnError.from(err, 'github').code },
        'pr body fetch failed — body null',
      );
      return null;
    }
    if (!raw) return null;
    const truncated = raw.length > PR_BODY_MAX_CHARS ? raw.slice(0, PR_BODY_MAX_CHARS) : raw;
    try {
      assertNoForbiddenPayload(truncated, `github.pr-body.${item.repo}#${item.number}`);
    } catch (err) {
      this.logger.warn(
        { repo: item.repo, number: item.number, err: CairnError.from(err, 'github').message },
        'pr body contains forbidden pattern — body dropped',
      );
      return null;
    }
    return truncated;
  }
}

function deriveState(item: SearchPrItem): GithubPrState {
  if (item.mergedAt) return 'merged';
  return item.state;
}
