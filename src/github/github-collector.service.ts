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
  PrCommitOnDate,
} from '../contracts/github-activity.types.js';
import { SecretsService } from '../secrets/secrets.service.js';
import type { GithubAccountConfig } from '../worklog-config/worklog-config.schema.js';
import { WorklogConfigService } from '../worklog-config/worklog-config.service.js';
import { kstDateToUtcWindow, searchRangeFragment } from './date-window.js';
import { GithubApiClient, type SearchPrItem } from './github-api.client.js';

const PR_BODY_MAX_CHARS = 800;
const PR_COMMIT_SUBJECT_MAX_CHARS = 200;

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

  async collect(date: string, lookbackDays = 14): Promise<GithubActivity> {
    const window = kstDateToUtcWindow(date);
    const range = searchRangeFragment(window);
    const lookbackStartIso = computeLookbackStartIso(date, lookbackDays, window.startIso);
    const widenedRange = `${lookbackStartIso}..${window.endIso}`;
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

    this.logger.info(
      { date, range, widenedRange, lookbackDays, accountCount: accounts.length },
      'github collect start',
    );

    const settled = await Promise.allSettled(
      accounts.map((account) =>
        this.collectAccount(account, range, widenedRange, window.startIso, window.endIso),
      ),
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
    widenedRange: string,
    sinceIso: string,
    untilIso: string,
  ): Promise<GithubPrSummary[]> {
    const token = this.secrets.getEnv(account.tokenEnv);
    if (!token) {
      throw CairnError.githubTokenMissing(account.tokenEnv);
    }

    const loginPromise = this.client.healthCheck(token).then((id) => id.login);
    const [involved, reviewed, commented] = await Promise.all([
      this.client.searchPrs(token, `involves:@me updated:${widenedRange}`),
      this.client.searchPrs(token, `reviewed-by:@me updated:${range}`),
      this.client.searchPrs(token, `commenter:@me updated:${range}`),
    ]);
    const myLogin = await loginPromise;

    const buckets = new Map<string, PrBucket>();
    for (const item of involved) {
      const key = `${account.label}/${item.owner}/${item.repo}#${item.number}`;
      const bucket = buckets.get(key) ?? {
        account: account.label,
        item,
        categories: new Set<GithubActivityCategory>(),
      };
      bucket.categories.add('involved');
      if (item.author === myLogin) {
        bucket.categories.add('authored');
        if (item.mergedAt && item.mergedAt >= sinceIso && item.mergedAt <= untilIso) {
          bucket.categories.add('authored_merged');
        }
      }
      buckets.set(key, bucket);
    }
    this.tag(buckets, account.label, reviewed, 'reviewed');
    this.tag(buckets, account.label, commented, 'commented');

    const enriched = await Promise.all(
      [...buckets.values()].map((bucket) =>
        this.toPrSummary(token, bucket, sinceIso, untilIso, myLogin),
      ),
    );
    return enriched.filter((pr) => belongsToDay(pr, sinceIso, untilIso));
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

  private async toPrSummary(
    token: string,
    bucket: PrBucket,
    sinceIso: string,
    untilIso: string,
    myLogin: string,
  ): Promise<GithubPrSummary> {
    const { account, item, categories } = bucket;
    const skipCommitsOnDate = categories.has('authored_merged') && item.createdAt < sinceIso;
    const skipBody = categories.size === 1 && categories.has('involved');

    const [changedFileNames, body, commitsOnDate] = await Promise.all([
      this.client.listPrFileBasenames(token, item.owner, item.repo, item.number),
      skipBody ? Promise.resolve(null) : this.fetchSafeBody(token, item),
      skipCommitsOnDate
        ? Promise.resolve([] as readonly PrCommitOnDate[])
        : this.fetchSafeCommitsOnDate(token, item, sinceIso, untilIso, myLogin),
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
      commitsOnDate,
    };
  }

  private async fetchSafeCommitsOnDate(
    token: string,
    item: SearchPrItem,
    sinceIso: string,
    untilIso: string,
    myLogin: string,
  ): Promise<readonly PrCommitOnDate[]> {
    let raw: Array<{ shortSha: string; subject: string; authoredAt: string }>;
    try {
      raw = await this.client.listPrCommitsInRange(
        token,
        item.owner,
        item.repo,
        item.number,
        sinceIso,
        untilIso,
        myLogin,
      );
    } catch (err) {
      this.logger.warn(
        { repo: item.repo, number: item.number, err: CairnError.from(err, 'github').code },
        'pr commits-on-date fetch failed — empty',
      );
      return [];
    }
    const out: PrCommitOnDate[] = [];
    for (const c of raw) {
      const subject =
        c.subject.length > PR_COMMIT_SUBJECT_MAX_CHARS
          ? c.subject.slice(0, PR_COMMIT_SUBJECT_MAX_CHARS)
          : c.subject;
      try {
        assertNoForbiddenPayload(
          subject,
          `github.pr-commit.${item.repo}#${item.number}.${c.shortSha}`,
        );
      } catch {
        // commit subject 에 금지 패턴이 있으면 그 commit 만 빼고 계속
        this.logger.warn(
          { repo: item.repo, number: item.number, sha: c.shortSha },
          'pr commit subject contains forbidden pattern — commit dropped',
        );
        continue;
      }
      out.push({ shortSha: c.shortSha, subject, authoredAt: c.authoredAt });
    }
    return out;
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

function belongsToDay(pr: GithubPrSummary, sinceIso: string, untilIso: string): boolean {
  if (pr.categories.includes('reviewed') || pr.categories.includes('commented')) return true;
  if (pr.categories.includes('authored_merged')) return true;
  if (pr.commitsOnDate.length > 0) return true;
  if (pr.createdAt >= sinceIso && pr.createdAt <= untilIso) return true;
  return false;
}

function computeLookbackStartIso(date: string, lookbackDays: number, dayStartIso: string): string {
  if (lookbackDays <= 0) return dayStartIso;
  const parts = date.split('-').map(Number);
  const [y, m, d] = parts;
  if (y === undefined || m === undefined || d === undefined) return dayStartIso;
  const startKst = new Date(Date.UTC(y, m - 1, d - lookbackDays, -9, 0, 0));
  return startKst.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
