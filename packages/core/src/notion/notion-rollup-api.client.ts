import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotionApiClient } from './notion-api.client.js';
import type {
  CreateRollupDatabaseInput,
  CreateRollupDatabaseResult,
  CreateRollupPageInput,
  ExistingRollupPage,
} from './notion-api.types.js';
import { appendChildrenInBatches, NOTION_MAX_CHILDREN } from './notion-page-create.js';

@Injectable()
export class NotionRollupApiClient {
  constructor(
    private readonly api: NotionApiClient,
    @InjectPinoLogger(NotionRollupApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async createRollupDatabase(
    input: CreateRollupDatabaseInput,
  ): Promise<CreateRollupDatabaseResult> {
    const client = this.api.getClient(input.token);
    const res = await client.databases.create({
      parent: { type: 'page_id', page_id: input.parentPageId },
      title: [{ type: 'text', text: { content: input.title } }],
      is_inline: true,
      initial_data_source: {
        properties: {
          Title: { title: {} },
          Period: {
            select: {
              options: [
                { name: 'weekly', color: 'blue' },
                { name: 'monthly', color: 'purple' },
                { name: 'yearly', color: 'red' },
              ],
            },
          },
          'Range start': { date: {} },
          'Range end': { date: {} },
          Tags: {
            multi_select: {
              options: [
                { name: 'auto', color: 'default' },
                { name: 'rollup', color: 'orange' },
              ],
            },
          },
          Status: {
            select: {
              options: [
                { name: 'draft', color: 'yellow' },
                { name: 'final', color: 'green' },
              ],
            },
          },
          'Created at': { created_time: {} },
          'Last edited at': { last_edited_time: {} },
        },
      },
    });
    const dataSources = (res as { data_sources?: Array<{ id?: string }> }).data_sources;
    const dataSourceId = dataSources?.[0]?.id;
    if (!dataSourceId) {
      throw new Error('createRollupDatabase: response missing data_sources[0].id');
    }
    this.logger.info({ databaseId: res.id, dataSourceId }, 'rollup database created');
    return { databaseId: res.id, dataSourceId };
  }

  async findRollupPageByRange(
    token: string,
    dataSourceId: string,
    period: 'weekly' | 'monthly' | 'yearly',
    rangeStart: string,
    rangeEnd: string,
  ): Promise<ExistingRollupPage | null> {
    const client = this.api.getClient(token);
    const res = await client.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: 'Period', select: { equals: period } },
          { property: 'Range start', date: { equals: rangeStart } },
          { property: 'Range end', date: { equals: rangeEnd } },
        ],
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 1,
    });
    const first = res.results[0];
    if (!first || !('properties' in first)) return null;
    const props = (first as { properties: Record<string, unknown> }).properties;
    const statusProp = props.Status as { select?: { name?: string } | null } | undefined;
    const status = statusProp?.select?.name ?? null;
    return { pageId: first.id, status };
  }

  // 연간 롤업 수집용 — 기간 내 월간 정리 페이지 목록 (Range start 오름차순)
  async queryRollupPagesInRange(
    token: string,
    dataSourceId: string,
    period: 'weekly' | 'monthly',
    rangeStart: string,
    rangeEnd: string,
  ): Promise<Array<{ pageId: string; rangeStart: string; url: string | null }>> {
    const client = this.api.getClient(token);
    const res = await client.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        and: [
          { property: 'Period', select: { equals: period } },
          { property: 'Range start', date: { on_or_after: rangeStart } },
          { property: 'Range start', date: { on_or_before: rangeEnd } },
        ],
      },
      sorts: [
        { property: 'Range start', direction: 'ascending' },
        // 같은 달 중복(archive 실패 등) 시 dedupe 가 최신 편집본을 남기도록
        { timestamp: 'last_edited_time', direction: 'descending' },
      ],
      page_size: 100,
    });
    const out: Array<{ pageId: string; rangeStart: string; url: string | null }> = [];
    for (const page of res.results) {
      if (!('properties' in page)) continue;
      const props = (page as { properties: Record<string, unknown> }).properties;
      const startProp = props['Range start'] as { date?: { start?: string } | null } | undefined;
      const start = startProp?.date?.start;
      if (!start) continue;
      const url = 'url' in page && typeof page.url === 'string' ? page.url : null;
      out.push({ pageId: page.id, rangeStart: start.slice(0, 10), url });
    }
    return out;
  }

  async createRollupPage(
    input: CreateRollupPageInput,
  ): Promise<{ id: string; url: string | null }> {
    const client = this.api.getClient(input.token);
    const tags = input.tags ?? ['auto', 'rollup'];
    const children = input.children ?? [];
    const res = await client.pages.create({
      parent: { type: 'data_source_id', data_source_id: input.dataSourceId },
      properties: {
        Title: { title: [{ type: 'text', text: { content: input.title } }] },
        Period: { select: { name: input.period } },
        'Range start': { date: { start: input.rangeStart } },
        'Range end': { date: { start: input.rangeEnd } },
        Tags: { multi_select: tags.map((t) => ({ name: t })) },
        Status: { select: { name: 'draft' } },
      },
      ...(children.length ? { children: children.slice(0, NOTION_MAX_CHILDREN) as never } : {}),
    });
    if (children.length > NOTION_MAX_CHILDREN) {
      await appendChildrenInBatches(client, res.id, children.slice(NOTION_MAX_CHILDREN));
    }
    const url = 'url' in res && typeof res.url === 'string' ? res.url : null;
    return { id: res.id, url };
  }
}
