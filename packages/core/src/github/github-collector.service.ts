import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { withConcurrency } from '../common/concurrency.js';
import {
  localDateStartIsoBefore,
  localDateToUtcWindow,
  searchRangeFragment,
  todayLocalIsoDate,
} from '../common/date-window.js';
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
    const window = localDateToUtcWindow(date);
    const range = searchRangeFragment(window);
    // 오늘 (live daily) 은 PR.updated_at 이 아직 밀리지 않은 시점 → narrow 로 충분
    // 과거 (backfill) 만 widening 적용해서 updated_at 이 밀린 케이스 cover
    const isBackfill = date < todayLocalIsoDate();
    const effectiveLookback = isBackfill ? lookbackDays : 0;
    // backfill 은 updated_at 이 D 이후로 밀린 PR 까지 잡으려 lower bound 만 둔다(상한 없음).
    // 매우 활발한 계정의 오래된 날짜 backfill 은 updated-desc 1000 cap 에 잘릴 수 있음 — 페이징 재설계는 별도 과제.
    const backfillLowerBoundIso =
      effectiveLookback > 0 ? localDateStartIsoBefore(date, effectiveLookback) : null;
    const widenedRange = backfillLowerBoundIso ? `>=${backfillLowerBoundIso}` : range;
    const accounts = this.worklogConfig.getGithubAccounts();

    if (accounts.length === 0) {
      this.logger.warn('no githubAccounts configured in worklog.config.json — empty activity');
      return {
        date,
        rangeStart: window.startIso,
        rangeEnd: window.endIso,
        prs: [],
        accountLabels: [],
      };
    }

    this.logger.info(
      { date, range, widenedRange, lookbackDays, accountCount: accounts.length },
      'github collect start',
    );

    const settled = await Promise.allSettled(
      accounts.map((account) =>
        this.collectAccount(
          account,
          widenedRange,
          backfillLowerBoundIso,
          window.startIso,
          window.endIso,
        ),
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
      accountLabels: accounts.map((a) => a.label),
      ...(accountErrors.length > 0 ? { accountErrors } : {}),
    };
  }

  private async collectAccount(
    account: GithubAccountConfig,
    widenedRange: string,
    backfillLowerBoundIso: string | null,
    sinceIso: string,
    untilIso: string,
  ): Promise<GithubPrSummary[]> {
    const token = this.secrets.getEnv(account.tokenEnv);
    if (!token) {
      throw CairnError.githubTokenMissing(account.tokenEnv);
    }

    const loginPromise = this.client.getAuthenticatedLogin(token);
    // backfill 은 캐시 경로 — 동시 backfill 날짜들이 lower bound 만 다른 동일 검색을 공유
    const involved = backfillLowerBoundIso
      ? await this.client.searchPrsUpdatedSince(token, 'involves:@me', backfillLowerBoundIso)
      : await this.client.searchPrs(token, `involves:@me updated:${widenedRange}`);
    const myLogin = await loginPromise;

    const buckets = new Map<string, PrBucket>();
    for (const item of involved) {
      const isAuthored = item.author === myLogin;
      const isAssigned = item.assignees.includes(myLogin);
      if (!isAuthored && !isAssigned) continue;
      const key = `${account.label}/${item.owner}/${item.repo}#${item.number}`;
      const bucket = buckets.get(key) ?? {
        account: account.label,
        item,
        categories: new Set<GithubActivityCategory>(),
      };
      bucket.categories.add('involved');
      if (isAssigned) bucket.categories.add('assigned');
      if (isAuthored) {
        bucket.categories.add('authored');
        if (item.mergedAt && item.mergedAt >= sinceIso && item.mergedAt <= untilIso) {
          bucket.categories.add('authored_merged');
        }
      }
      buckets.set(key, bucket);
    }

    // GitHub API secondary rate limit 회피를 위해 token 당 동시 호출 5 개로 제한
    const phase1 = await withConcurrency([...buckets.values()], 5, async (bucket) => {
      const { item, categories } = bucket;
      const createdInDay = item.createdAt >= sinceIso && item.createdAt <= untilIso;
      const hasAuthoredMerged = categories.has('authored_merged');
      const needsCommitsForEligibility = !hasAuthoredMerged && !createdInDay;
      const commitsOnDate = needsCommitsForEligibility
        ? await this.fetchSafeCommitsOnDate(token, item, sinceIso, untilIso, myLogin)
        : [];
      const eligible = hasAuthoredMerged || createdInDay || commitsOnDate.length > 0;
      return { bucket, commitsOnDate, eligible, commitLookupAttempted: needsCommitsForEligibility };
    });

    const eligible = phase1.filter((p) => p.eligible);

    this.logger.info(
      {
        account: account.label,
        bucketCount: buckets.size,
        commitLookupCount: phase1.filter((p) => p.commitLookupAttempted).length,
        eligibleCount: eligible.length,
      },
      'github collect account classified',
    );

    let summaryCommitLookupCount = 0;
    const summaries = await withConcurrency(eligible, 5, async ({ bucket, commitsOnDate }) => {
      const { account: acc, item, categories } = bucket;
      // title 은 필수 필드라 null 화 불가 — 금지 패턴이면 PR 만 drop (전체 payload 백스톱이 하루치 발행을 막지 않게)
      try {
        assertNoForbiddenPayload(item.title, `github.pr-title.${item.repo}#${item.number}`);
      } catch {
        this.logger.warn(
          { repo: item.repo, number: item.number },
          'pr title contains forbidden pattern — pr dropped',
        );
        return null;
      }
      const shouldFetchCommitsForSummary = commitsOnDate.length === 0;
      const summaryCommitsOnDate = shouldFetchCommitsForSummary
        ? await this.fetchSafeCommitsOnDate(token, item, sinceIso, untilIso, myLogin)
        : commitsOnDate;
      if (shouldFetchCommitsForSummary) summaryCommitLookupCount += 1;
      const body = this.safeSearchBody(item);
      return {
        account: acc,
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
        categories: [...categories],
        body,
        commitsOnDate: summaryCommitsOnDate,
      };
    });
    this.logger.info(
      { account: account.label, summaryCommitLookupCount },
      'github collect account summarized',
    );
    return summaries.filter((s) => s !== null);
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

  private safeSearchBody(item: SearchPrItem): string | null {
    const raw = item.body;
    if (!raw) return null;
    const truncated = raw.length > PR_BODY_MAX_CHARS ? raw.slice(0, PR_BODY_MAX_CHARS) : raw;
    try {
      assertNoForbiddenPayload(truncated, `github.pr-body.${item.repo}#${item.number}`);
    } catch (err) {
      this.logger.warn(
        { repo: item.repo, number: item.number, err: CairnError.from(err, 'github').code },
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
