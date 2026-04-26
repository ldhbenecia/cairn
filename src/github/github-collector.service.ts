import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  GithubActivity,
  GithubActivityCategory,
  GithubPrState,
  GithubPrSummary,
} from '../contracts/github-activity.types.js';
import { kstDateToUtcWindow, searchRangeFragment } from './date-window.js';
import { GithubApiClient, type SearchPrItem } from './github-api.client.js';

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

    const prs = await Promise.all([...buckets.values()].map((bucket) => this.toPrSummary(bucket)));

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
    const changedFileNames = await this.client.listPrFileBasenames(
      item.owner,
      item.repo,
      item.number,
    );
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
    };
  }
}

function deriveState(item: SearchPrItem): GithubPrState {
  if (item.mergedAt) return 'merged';
  return item.state;
}
