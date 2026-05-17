import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type {
  CreateWorklogDatabaseInput,
  CreateWorklogDatabaseResult,
  CreateWorklogPageInput,
  ExistingWorklogPage,
  ExtractedBlock,
  RawNotionPage,
  SearchPagesResult,
  WorklogPageInRange,
} from './notion-api.types.js';

interface NotionTitleProperty {
  type: 'title';
  title: readonly { plain_text: string }[];
}

type SearchPageParent =
  | { type: 'database_id'; database_id: string }
  | { type: 'data_source_id'; data_source_id: string }
  | { type: 'page_id'; page_id: string }
  | { type: 'workspace'; workspace: true }
  | { type: 'block_id'; block_id: string };

interface SearchPageItem {
  object: 'page';
  id: string;
  url: string;
  last_edited_time: string;
  last_edited_by: { id: string };
  parent: SearchPageParent;
  properties: Record<string, { type: string } & Partial<NotionTitleProperty>>;
}

@Injectable()
export class NotionApiClient {
  private readonly clients = new Map<string, Client>();

  constructor(
    @InjectPinoLogger(NotionApiClient.name)
    private readonly logger: PinoLogger,
  ) {}

  async searchPages(
    token: string,
    opts: { startCursor?: string; pageSize?: number } = {},
  ): Promise<SearchPagesResult> {
    const client = this.getClient(token);
    const res = await client.search({
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      filter: { value: 'page', property: 'object' },
      start_cursor: opts.startCursor,
      page_size: opts.pageSize ?? 100,
    });

    const pages: RawNotionPage[] = [];
    for (const item of res.results) {
      if (!isFullPage(item)) continue;
      pages.push(toRawPage(item));
    }

    return { pages, nextCursor: res.has_more ? res.next_cursor : null };
  }

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
          'Source counts': { rich_text: {} },
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
    const res = await client.pages.create({
      parent: { type: 'data_source_id', data_source_id: input.dataSourceId },
      properties: {
        Title: { title: [{ type: 'text', text: { content: input.title } }] },
        Date: { date: { start: input.date } },
        Tags: { multi_select: tags.map((t) => ({ name: t })) },
        'Source counts': {
          rich_text: [{ type: 'text', text: { content: input.sourceCounts } }],
        },
        Status: { select: { name: 'draft' } },
      },
      ...(input.children ? { children: input.children as never } : {}),
    });
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
        const sourceCounts = extractSourceCounts(props);
        out.push({ pageId: item.id, url, date, sourceCounts });
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
      client = new Client({ auth: token });
      this.clients.set(token, client);
      this.logger.debug('notion client initialized');
    }
    return client;
  }
}

function isFullPage(item: unknown): item is SearchPageItem {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    obj.object === 'page' &&
    typeof obj.id === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.last_edited_time === 'string' &&
    typeof obj.last_edited_by === 'object' &&
    obj.last_edited_by !== null &&
    'properties' in obj &&
    'parent' in obj
  );
}

function toRawPage(page: SearchPageItem): RawNotionPage {
  return {
    id: page.id,
    url: page.url,
    lastEditedTime: page.last_edited_time,
    lastEditedById: page.last_edited_by.id,
    parentType: page.parent.type,
    parentId: extractParentId(page.parent),
    title: extractTitle(page),
  };
}

function extractParentId(parent: SearchPageParent): string | null {
  switch (parent.type) {
    case 'database_id':
      return parent.database_id;
    case 'data_source_id':
      return parent.data_source_id;
    case 'page_id':
      return parent.page_id;
    case 'block_id':
      return parent.block_id;
    case 'workspace':
      return null;
  }
}

function extractTitle(page: SearchPageItem): string {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === 'title' && prop.title) {
      const text = prop.title
        .map((t) => t.plain_text)
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return '(untitled)';
}

interface RichTextItem {
  plain_text?: string;
}

function extractSourceCounts(props: Record<string, unknown>): string {
  const sc = props['Source counts'] as { rich_text?: RichTextItem[] } | undefined;
  if (!sc?.rich_text) return '';
  return sc.rich_text
    .map((rt) => rt.plain_text ?? '')
    .join('')
    .trim();
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
