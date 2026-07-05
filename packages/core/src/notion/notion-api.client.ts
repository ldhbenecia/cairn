import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  CreateWorklogDatabaseInput,
  CreateWorklogDatabaseResult,
  CreateWorklogPageInput,
  ExistingWorklogPage,
  ExtractedBlock,
  WorklogPageInRange,
} from './notion-api.types.js';
import { appendChildrenInBatches, NOTION_MAX_CHILDREN } from './notion-page-create.js';

@Injectable()
export class NotionApiClient {
  private readonly clients = new Map<string, Client>();
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  constructor(
    @InjectPinoLogger(NotionApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async createWorklogDatabase(
    input: CreateWorklogDatabaseInput,
  ): Promise<CreateWorklogDatabaseResult> {
    const client = this.getClient(input.token);
    const res = await client.databases.create({
      parent: { type: 'page_id', page_id: input.parentPageId },
      title: [{ type: 'text', text: { content: input.title } }],
      is_inline: true,
      initial_data_source: {
        properties: {
          Title: { title: {} },
          Date: { date: {} },
          Tags: {
            multi_select: {
              options: [
                { name: 'auto', color: 'default' },
                { name: 'daily', color: 'blue' },
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
      throw new Error('createWorklogDatabase: response missing data_sources[0].id');
    }
    return { databaseId: res.id, dataSourceId };
  }

  async getPrimaryDataSourceId(token: string, databaseId: string): Promise<string> {
    const client = this.getClient(token);
    const res = await client.databases.retrieve({ database_id: databaseId });
    const dataSources = (res as { data_sources?: Array<{ id?: string }> }).data_sources;
    const dataSourceId = dataSources?.[0]?.id;
    if (!dataSourceId) {
      throw new Error(`getPrimaryDataSourceId: database ${databaseId} has no data_sources`);
    }
    return dataSourceId;
  }

  async findWorklogPageByDate(
    token: string,
    dataSourceId: string,
    isoDate: string,
  ): Promise<ExistingWorklogPage | null> {
    const client = this.getClient(token);
    const res = await client.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: 'Date', date: { equals: isoDate } },
      // 중복 페이지가 있을 때(예: force 중 archive 실패) 항상 최신 것을 잡도록 created_time desc
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

  async createWorklogPage(
    input: CreateWorklogPageInput,
  ): Promise<{ id: string; url: string | null }> {
    const client = this.getClient(input.token);
    const tags = input.tags ?? ['auto', 'daily'];
    const children = input.children ?? [];
    const res = await client.pages.create({
      parent: { type: 'data_source_id', data_source_id: input.dataSourceId },
      properties: {
        Title: { title: [{ type: 'text', text: { content: input.title } }] },
        Date: { date: { start: input.date } },
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

  async archivePage(token: string, pageId: string): Promise<void> {
    const client = this.getClient(token);
    await client.pages.update({ page_id: pageId, archived: true });
  }

  async queryWorklogPagesInRange(
    token: string,
    dataSourceId: string,
    rangeStart: string,
    rangeEnd: string,
  ): Promise<readonly WorklogPageInRange[]> {
    const client = this.getClient(token);
    const out: WorklogPageInRange[] = [];
    let cursor: string | undefined = undefined;

    do {
      const res = await client.dataSources.query({
        data_source_id: dataSourceId,
        filter: {
          and: [
            { property: 'Date', date: { on_or_after: rangeStart } },
            { property: 'Date', date: { on_or_before: rangeEnd } },
          ],
        },
        sorts: [{ property: 'Date', direction: 'ascending' }],
        start_cursor: cursor,
        page_size: 100,
      });

      for (const item of res.results) {
        if (!('properties' in item)) continue;
        const props = (item as { properties: Record<string, unknown> }).properties;
        const dateProp = props.Date as { date?: { start?: string } | null } | undefined;
        const date = dateProp?.date?.start ?? null;
        if (!date) continue;
        const url = 'url' in item && typeof item.url === 'string' ? item.url : null;
        out.push({ pageId: item.id, url, date });
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return out;
  }

  async getPageBlocks(token: string, pageId: string): Promise<readonly ExtractedBlock[]> {
    const client = this.getClient(token);
    const out: ExtractedBlock[] = [];
    let cursor: string | undefined = undefined;

    do {
      const res = await client.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor,
        page_size: 100,
      });
      for (const block of res.results) {
        out.push(toExtractedBlock(block));
      }
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return out;
  }

  getClient(token: string): Client {
    let client = this.clients.get(token);
    if (!client) {
      client = new Client({ auth: token, timeoutMs: NotionApiClient.REQUEST_TIMEOUT_MS });
      this.clients.set(token, client);
      this.logger.debug('notion client initialized');
    }
    return client;
  }
}

function plainTextFromRichText(rt: unknown): string {
  if (!Array.isArray(rt)) return '';
  return rt
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const obj = item as { plain_text?: unknown };
      return typeof obj.plain_text === 'string' ? obj.plain_text : '';
    })
    .join('')
    .trim();
}

function toExtractedBlock(block: unknown): ExtractedBlock {
  if (!block || typeof block !== 'object') return { type: 'other' };
  const obj = block as { type?: string } & Record<string, unknown>;

  if (obj.type === 'heading_2') {
    const inner = obj.heading_2 as { rich_text?: unknown } | undefined;
    return { type: 'heading_2', text: plainTextFromRichText(inner?.rich_text) };
  }
  if (obj.type === 'paragraph') {
    const inner = obj.paragraph as { rich_text?: unknown } | undefined;
    return { type: 'paragraph', text: plainTextFromRichText(inner?.rich_text) };
  }
  if (obj.type === 'bulleted_list_item') {
    const inner = obj.bulleted_list_item as { rich_text?: unknown } | undefined;
    return { type: 'bulleted_list_item', text: plainTextFromRichText(inner?.rich_text) };
  }
  return { type: 'other' };
}
