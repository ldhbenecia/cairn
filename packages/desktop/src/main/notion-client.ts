import { Client } from '@notionhq/client';
import { errorMessage } from './error-message';
import { readStatsFile } from './cloud-sync';
import { readConfig } from './files';
import { secretValue } from './secret-store';
import type {
  RecentCategory,
  RecentPage,
  RecentWarning,
  RichSpan,
  SimpleBlock,
  PageContent,
} from '../shared/ipc-types';
export type {
  RecentCategory,
  WorklogSink,
  RecentPage,
  RecentWarning,
  RichSpan,
  SimpleBlock,
  PageContent,
} from '../shared/ipc-types';

type NotionWorkspaceConfig = {
  label: string;
  tokenEnv: string;
  worklog?: { dataSourceId?: string };
  rollup?: { dataSourceId?: string };
};

type ParsedConfig = {
  notionWorkspaces: NotionWorkspaceConfig[];
};

const PAGE_SIZE = 100; // Notion 쿼리 1회 최대
const MAX_QUERY_PAGES = 6; // 데이터소스당 600건까지 — 히트맵 53주분 일간
const MAX_RECENT_PAGES = 800;

type NotionPageItem = { id: string; url?: string; properties: Record<string, unknown> };

// 단일 쿼리는 100건 상한이라 cursor 로 상한 내 끝까지 페이징
async function queryAllResults(
  notion: Client,
  params: { data_source_id: string; sorts: Array<{ property: string; direction: 'descending' }> },
): Promise<unknown[]> {
  const items: unknown[] = [];
  let cursor: string | undefined;
  for (let p = 0; p < MAX_QUERY_PAGES; p += 1) {
    const res = await notion.dataSources.query({
      data_source_id: params.data_source_id,
      sorts: params.sorts,
      page_size: PAGE_SIZE,
      start_cursor: cursor,
    });
    items.push(...res.results);
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return items;
}

const notionClients = new Map<string, Client>();

function getNotion(token: string): Client {
  let client = notionClients.get(token);
  if (!client) {
    client = new Client({ auth: token });
    notionClients.set(token, client);
  }
  return client;
}

function readTitle(props: Record<string, unknown>): string {
  const p = props.Title as { title?: Array<{ plain_text?: string }> } | undefined;
  return p?.title?.map((t) => t.plain_text ?? '').join('') || '(no title)';
}

function rollupCategory(period: string | null): RecentCategory {
  if (period === 'monthly') return 'monthly';
  if (period === 'yearly') return 'yearly';
  return 'weekly';
}

function readSelect(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { select?: { name?: string } | null } | undefined;
  return p?.select?.name ?? null;
}

function readDate(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { date?: { start?: string } | null } | undefined;
  return p?.date?.start ?? null;
}

export async function listRecentPages(): Promise<{
  pages: RecentPage[];
  warnings: RecentWarning[];
}> {
  const cfg = await readConfig();
  const parsed = cfg.parsed as ParsedConfig | null;
  if (!parsed?.notionWorkspaces?.length) {
    return { pages: [], warnings: [{ code: 'no-workspaces' }] };
  }

  const results = await Promise.all(parsed.notionWorkspaces.map((ws) => listWorkspacePages(ws)));
  const allPages = results.flatMap((r) => r.pages);
  const warnings = results.flatMap((r) => r.warnings);

  allPages.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { pages: allPages.slice(0, MAX_RECENT_PAGES), warnings };
}

async function listWorkspacePages(
  ws: NotionWorkspaceConfig,
): Promise<{ pages: RecentPage[]; warnings: RecentWarning[] }> {
  const pages: RecentPage[] = [];
  const warnings: RecentWarning[] = [];

  const token = secretValue(ws.tokenEnv);
  if (!token) {
    warnings.push({ code: 'token-missing', workspace: ws.label, tokenEnv: ws.tokenEnv });
    return { pages, warnings };
  }
  const notion = getNotion(token);

  const tasks: Array<Promise<void>> = [];

  const worklogDs = ws.worklog?.dataSourceId;
  if (!worklogDs) {
    warnings.push({ code: 'no-data-source', workspace: ws.label });
  } else {
    tasks.push(
      listDailyPages(notion, worklogDs, ws.label)
        .then((dailyPages) => {
          pages.push(...dailyPages);
        })
        .catch((err: unknown) => {
          warnings.push({
            code: 'fetch-failed',
            workspace: ws.label,
            kind: 'worklog',
            detail: errorMessage(err),
          });
        }),
    );
  }

  const rollupDs = ws.rollup?.dataSourceId;
  if (rollupDs) {
    tasks.push(
      listRollupPages(notion, rollupDs, ws.label)
        .then((rollupPages) => {
          pages.push(...rollupPages);
        })
        .catch((err: unknown) => {
          warnings.push({
            code: 'fetch-failed',
            workspace: ws.label,
            kind: 'rollup',
            detail: errorMessage(err),
          });
        }),
    );
  }

  await Promise.all(tasks);
  return { pages, warnings };
}

async function listDailyPages(
  notion: Client,
  dataSourceId: string,
  workspaceLabel: string,
): Promise<RecentPage[]> {
  const results = await queryAllResults(notion, {
    data_source_id: dataSourceId,
    sorts: [{ property: 'Date', direction: 'descending' }],
  });

  // 통계 진실 소스는 노션이 아닌 로컬 파일(core 가 발행 시 기록), key 는 `${category}:${date}`
  const stats = readStatsFile();
  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('properties' in item)) return [];
    const { id, properties: props, url } = item as NotionPageItem;
    const date = readDate(props, 'Date');
    const stat = date ? stats[`daily:${date}`] : undefined;
    return [
      {
        pageId: id,
        url: url ?? '',
        title: readTitle(props),
        date,
        status: readSelect(props, 'Status'),
        category: 'daily' as const,
        pr: stat?.pr ?? null,
        commit: stat?.commit ?? null,
        hours: stat?.hours ?? null,
        workspaceLabel,
      },
    ];
  });
}

async function listRollupPages(
  notion: Client,
  dataSourceId: string,
  workspaceLabel: string,
): Promise<RecentPage[]> {
  const results = await queryAllResults(notion, {
    data_source_id: dataSourceId,
    sorts: [{ property: 'Range end', direction: 'descending' }],
  });

  return results.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('properties' in item)) return [];
    const { id, properties: props, url } = item as NotionPageItem;
    return [
      {
        pageId: id,
        url: url ?? '',
        title: readTitle(props),
        date: readDate(props, 'Range end') ?? readDate(props, 'Range start'),
        status: readSelect(props, 'Status'),
        category: rollupCategory(readSelect(props, 'Period')),
        pr: null,
        commit: null,
        hours: null,
        workspaceLabel,
      },
    ];
  });
}

type RawRichText = {
  plain_text?: string;
  href?: string | null;
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean };
};

function richSpans(rt: RawRichText[] | undefined): RichSpan[] {
  return (rt ?? []).map((t) => ({
    text: t.plain_text ?? '',
    bold: t.annotations?.bold,
    italic: t.annotations?.italic,
    code: t.annotations?.code,
    strike: t.annotations?.strikethrough,
    href: t.href ?? undefined,
  }));
}

const MAX_DEPTH = 3;

async function fetchBlocks(notion: Client, blockId: string, depth: number): Promise<SimpleBlock[]> {
  const out: SimpleBlock[] = [];
  const pendingChildren: { sb: SimpleBlock; blockId: string }[] = [];
  let cursor: string | undefined;

  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const item of res.results) {
      if (!('type' in item)) continue;
      const block = item as unknown as Record<string, unknown> & {
        id: string;
        type: string;
        has_children?: boolean;
      };
      const type = block.type;
      const body = block[type] as
        | {
            rich_text?: RawRichText[];
            checked?: boolean;
            language?: string;
            icon?: { emoji?: string; external?: { url?: string }; file?: { url?: string } };
          }
        | undefined;
      const sb: SimpleBlock = { id: block.id, type, rich: richSpans(body?.rich_text) };
      if (type === 'to_do') sb.checked = body?.checked ?? false;
      if (type === 'code') sb.language = body?.language;
      if (type === 'callout') {
        sb.icon = body?.icon?.emoji;
        sb.iconUrl = body?.icon?.external?.url ?? body?.icon?.file?.url;
      }
      if (
        block.has_children &&
        type !== 'child_database' &&
        type !== 'child_page' &&
        depth < MAX_DEPTH
      ) {
        pendingChildren.push({ sb, blockId: block.id });
      }
      out.push(sb);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // 자식 블록을 직렬 재귀로 기다리면 라운드트립이 합산돼 드로어가 수 초 지연 — Notion rate limit 고려해 동시성 4
  const CHILD_CONCURRENCY = 4;
  for (let i = 0; i < pendingChildren.length; i += CHILD_CONCURRENCY) {
    const batch = pendingChildren.slice(i, i + CHILD_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ sb, blockId }) => {
        sb.children = await fetchBlocks(notion, blockId, depth + 1);
      }),
    );
  }

  return out;
}

export async function fetchPageContent(
  pageId: string,
  workspaceLabel: string,
): Promise<PageContent> {
  const cfg = await readConfig();
  const parsed = cfg.parsed as ParsedConfig | null;
  const ws =
    parsed?.notionWorkspaces?.find((w) => w.label === workspaceLabel) ??
    parsed?.notionWorkspaces?.[0];
  const token = ws ? secretValue(ws.tokenEnv) : undefined;
  if (!token) return { blocks: [], warning: 'token 없음' };

  try {
    const notion = getNotion(token);
    return { blocks: await fetchBlocks(notion, pageId, 0) };
  } catch (err) {
    return { blocks: [], warning: errorMessage(err) };
  }
}

// 발행 워크스페이스 라벨을 모르는 경로(export 자동 sync)용 — 첫 워크스페이스만 쓰면 두 번째
// 워크스페이스 발행분이 조용히 skip 돼 토큰을 차례로 시도
export async function fetchPageContentAnyWorkspace(pageId: string): Promise<PageContent> {
  const cfg = await readConfig();
  const parsed = cfg.parsed as ParsedConfig | null;
  const labels = (parsed?.notionWorkspaces ?? []).map((w) => w.label);
  let last: PageContent = { blocks: [], warning: 'no workspace' };
  for (const label of labels) {
    last = await fetchPageContent(pageId, label);
    if (last.blocks.length > 0) return last;
  }
  return last;
}
