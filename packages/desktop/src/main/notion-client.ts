import { Client } from '@notionhq/client';
import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from './files';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

const CAIRN_ROOT = app.isPackaged
  ? (process.env.CAIRN_HOME ?? join(homedir(), '.cairn'))
  : resolve(__dirname, '../../../..');

let envLoaded = false;
function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;
  try {
    const content = readFileSync(join(CAIRN_ROOT, '.env'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env 없으면 skip — listRecentPages 가 token 못 찾으면 warning 으로 표시
  }
}

export type RecentCategory = 'daily' | 'weekly' | 'monthly';

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  category: RecentCategory;
  pr: number | null;
  commit: number | null;
  hours: number[] | null;
  workspaceLabel: string;
};

type NotionWorkspaceConfig = {
  label: string;
  tokenEnv: string;
  worklog?: { dataSourceId?: string };
  rollup?: { dataSourceId?: string };
};

type ParsedConfig = {
  notionWorkspaces: NotionWorkspaceConfig[];
};

const PAGE_SIZE = 100;

type NotionPageItem = { id: string; url?: string; properties: Record<string, unknown> };

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

function readSelect(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { select?: { name?: string } | null } | undefined;
  return p?.select?.name ?? null;
}

function readDate(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { date?: { start?: string } | null } | undefined;
  return p?.date?.start ?? null;
}

// 통계 진실 소스는 노션이 아닌 로컬 파일(core 가 발행 시 기록). key 는 `${category}:${date}`.
type WorklogStat = { pr: number; commit: number; hours?: number[] };
const STATS_PATH = join(homedir(), '.cairn', 'worklog-stats.json');
function readWorklogStats(): Record<string, WorklogStat> {
  try {
    return JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, WorklogStat>;
  } catch {
    return {};
  }
}

export async function listRecentPages(): Promise<{
  pages: RecentPage[];
  warnings: string[];
}> {
  ensureEnvLoaded();
  const cfg = await readConfig();
  const parsed = cfg.parsed as ParsedConfig | null;
  if (!parsed?.notionWorkspaces?.length) {
    return { pages: [], warnings: ['worklog.config.json 에 notionWorkspaces 가 없음'] };
  }

  const results = await Promise.all(parsed.notionWorkspaces.map((ws) => listWorkspacePages(ws)));
  const allPages = results.flatMap((r) => r.pages);
  const warnings = results.flatMap((r) => r.warnings);

  allPages.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { pages: allPages.slice(0, PAGE_SIZE), warnings };
}

async function listWorkspacePages(
  ws: NotionWorkspaceConfig,
): Promise<{ pages: RecentPage[]; warnings: string[] }> {
  const pages: RecentPage[] = [];
  const warnings: string[] = [];

  const token = process.env[ws.tokenEnv];
  if (!token) {
    warnings.push(`${ws.label}: token env "${ws.tokenEnv}" 없음`);
    return { pages, warnings };
  }
  const notion = getNotion(token);

  const tasks: Array<Promise<void>> = [];

  const worklogDs = ws.worklog?.dataSourceId;
  if (!worklogDs) {
    warnings.push(`${ws.label}: worklog.dataSourceId 없음`);
  } else {
    tasks.push(
      listDailyPages(notion, worklogDs, ws.label)
        .then((dailyPages) => {
          pages.push(...dailyPages);
        })
        .catch((err: unknown) => {
          warnings.push(
            `${ws.label} (worklog): ${err instanceof Error ? err.message : String(err)}`,
          );
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
          warnings.push(
            `${ws.label} (rollup): ${err instanceof Error ? err.message : String(err)}`,
          );
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
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: PAGE_SIZE,
    sorts: [{ property: 'Date', direction: 'descending' }],
  });

  const stats = readWorklogStats();
  return res.results.flatMap((item) => {
    if (!('properties' in item)) return [];
    const { properties: props, url } = item as NotionPageItem;
    const date = readDate(props, 'Date');
    const stat = date ? stats[`daily:${date}`] : undefined;
    return [
      {
        pageId: item.id,
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
  const res = await notion.dataSources.query({
    data_source_id: dataSourceId,
    page_size: PAGE_SIZE,
    sorts: [{ property: 'Range end', direction: 'descending' }],
  });

  return res.results.flatMap((item) => {
    if (!('properties' in item)) return [];
    const { properties: props, url } = item as NotionPageItem;
    return [
      {
        pageId: item.id,
        url: url ?? '',
        title: readTitle(props),
        date: readDate(props, 'Range end') ?? readDate(props, 'Range start'),
        status: readSelect(props, 'Status'),
        category:
          readSelect(props, 'Period') === 'monthly' ? ('monthly' as const) : ('weekly' as const),
        pr: null,
        commit: null,
        hours: null,
        workspaceLabel,
      },
    ];
  });
}

export type RichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  href?: string;
};

export type SimpleBlock = {
  id: string;
  type: string;
  rich: RichSpan[];
  checked?: boolean;
  language?: string;
  icon?: string;
  iconUrl?: string;
  children?: SimpleBlock[];
};

export type PageContent = { blocks: SimpleBlock[]; warning?: string };

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
        sb.children = await fetchBlocks(notion, block.id, depth + 1);
      }
      out.push(sb);
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return out;
}

export async function fetchPageContent(
  pageId: string,
  workspaceLabel: string,
): Promise<PageContent> {
  ensureEnvLoaded();
  const cfg = await readConfig();
  const parsed = cfg.parsed as ParsedConfig | null;
  const ws =
    parsed?.notionWorkspaces?.find((w) => w.label === workspaceLabel) ??
    parsed?.notionWorkspaces?.[0];
  const token = ws ? process.env[ws.tokenEnv] : undefined;
  if (!token) return { blocks: [], warning: 'token 없음' };

  try {
    const notion = getNotion(token);
    return { blocks: await fetchBlocks(notion, pageId, 0) };
  } catch (err) {
    return { blocks: [], warning: err instanceof Error ? err.message : String(err) };
  }
}
