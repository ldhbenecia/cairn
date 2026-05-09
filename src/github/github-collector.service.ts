import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CairnError } from '../common/error.js';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type {
  GithubActivity,
  GithubActivityCategory,
  GithubPrState,
  GithubPrSummary,
} from '../contracts/github-activity.types.js';
import { kstDateToUtcWindow, searchRangeFragment } from './date-window.js';
import { GithubApiClient, type SearchPrItem } from './github-api.client.js';

const PR_BODY_MAX_CHARS = 800;

interface PrBucket {
  item: SearchPrItem;
  categories: Set<GithubActivityCategory>;
}

@Injectable()
export class GithubCollectorService {
  constructor(
    private readonly client: GithubApiClient,
    @InjectPinoLogger(GithubCollectorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async collect(date: string): Promise<GithubActivity> {
    const window = kstDateToUtcWindow(date);
    const range = searchRangeFragment(window);
    this.logger.info({ date, range }, 'github collect start');

    try {
      const [authored, authoredMerged, reviewed, commented] = await Promise.all([
        this.client.searchPrs(`author:@me updated:${range}`),
        this.client.searchPrs(`author:@me merged:${range}`),
        this.client.searchPrs(`reviewed-by:@me updated:${range}`),
        this.client.searchPrs(`commenter:@me updated:${range}`),
      ]);

      const buckets = new Map<string, PrBucket>();
      this.tag(buckets, authored, 'authored');
      this.tag(buckets, authoredMerged, 'authored_merged');
      this.tag(buckets, reviewed, 'reviewed');
      this.tag(buckets, commented, 'commented');

      const prs = await Promise.all(
        [...buckets.values()].map((bucket) => this.toPrSummary(bucket)),
      );

      this.logger.info(
        {
          date,
          prCount: prs.length,
          authored: authored.length,
          authoredMerged: authoredMerged.length,
          reviewed: reviewed.length,
          commented: commented.length,
        },
        'github collect done',
      );

      return {
        date,
        rangeStart: window.startIso,
        rangeEnd: window.endIso,
        prs,
      };
    } catch (err) {
      const error = CairnError.from(err, 'github');
      this.logger.warn(
        { date, error },
        'github collect failed — returning empty activity (token / rate limit / network)',
      );
      return {
        date,
        rangeStart: window.startIso,
        rangeEnd: window.endIso,
        prs: [],
        error,
      };
    }
  }

  private tag(
    buckets: Map<string, PrBucket>,
    items: SearchPrItem[],
    category: GithubActivityCategory,
  ): void {
    for (const item of items) {
      const key = `${item.owner}/${item.repo}#${item.number}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.categories.add(category);
      } else {
        buckets.set(key, { item, categories: new Set([category]) });
      }
    }
  }

  private async toPrSummary(bucket: PrBucket): Promise<GithubPrSummary> {
    const { item, categories } = bucket;
    const [changedFileNames, body] = await Promise.all([
      this.client.listPrFileBasenames(item.owner, item.repo, item.number),
      this.fetchSafeBody(item),
    ]);
    return {
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

  private async fetchSafeBody(item: SearchPrItem): Promise<string | null> {
    let raw: string | null;
    try {
      raw = await this.client.fetchPrBody(item.owner, item.repo, item.number);
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
