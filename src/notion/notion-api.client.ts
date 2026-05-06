import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export type NotionParentTypeRaw = 'database_id' | 'page_id' | 'workspace' | 'block_id';

export interface RawNotionPage {
  id: string;
  url: string;
  lastEditedTime: string;
  lastEditedById: string;
  parentType: NotionParentTypeRaw;
  title: string;
}

export interface SearchPagesResult {
  pages: RawNotionPage[];
  nextCursor: string | null;
}

interface NotionTitleProperty {
  type: 'title';
  title: readonly { plain_text: string }[];
}

interface SearchPageItem {
  object: 'page';
  id: string;
  url: string;
  last_edited_time: string;
  last_edited_by: { id: string };
  parent: { type: NotionParentTypeRaw };
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

  private getClient(token: string): Client {
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
    title: extractTitle(page),
  };
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
