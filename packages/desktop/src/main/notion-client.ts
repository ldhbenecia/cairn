import { Client } from '@notionhq/client';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { errorMessage } from './error-message';
import { readConfig } from './files';
import { CAIRN_ROOT } from './setup';

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
    // .env 없으면 skip
  }
}

export type RecentCategory = 'daily' | 'weekly' | 'monthly';

export type WorklogSink = 'journal' | 'notion' | 'obsidian';

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
  // 병합부(listRecentMerged)에서 채움
  sinks?: WorklogSink[];
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

const PAGE_SIZE = 100; // Notion 쿼리 1회 최대
const MAX_QUERY_PAGES = 6; // 데이터소스당 최대 600건까지 페이징(백필로 일간이 100 초과 — 히트맵 53주 필요)
const MAX_RECENT_PAGES = 800;

type NotionPageItem = { id: string; url?: string; properties: Record<string, unknown> };

// 단일 쿼리는 100건 상한이라 cursor 로 끝까지(상한 내) 페이징. 일간이 100 넘으면 오래된 게 잘리던 문제 해결
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

function readSelect(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { select?: { name?: string } | null } | undefined;
  return p?.select?.name ?? null;
}

function readDate(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { date?: { start?: string } | null } | undefined;
  return p?.date?.start ?? null;
}

// 통계 진실 소스는 노션이 아닌 로컬 파일(core 가 발행 시 기록). key 는 `${category}:${date}`
type WorklogStat = { pr: number; commit: number; hours?: number[] };
const STATS_PATH = join(homedir(), '.cairn', 'worklog-stats.json');
function readWorklogStats(): Record<string, WorklogStat> {
  try {
    return JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, WorklogStat>;
  } catch {
    return {};
  }
}

// 경고는 코드로만 — 사용자 표시는 renderer 가 i18n 으로 매핑 (한국어 하드코딩이 EN 사용자에게 새지 않게)
export type RecentWarning =
  | { code: 'no-workspaces' }
  | { code: 'token-missing'; workspace: string; tokenEnv: string }
  | { code: 'no-data-source'; workspace: string }
  | { code: 'fetch-failed'; workspace: string; kind: 'worklog' | 'rollup'; detail: string };

export async function listRecentPages(): Promise<{
  pages: RecentPage[];
  warnings: RecentWarning[];
}> {
  ensureEnvLoaded();
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

  const token = process.env[ws.tokenEnv];
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

  const stats = readWorklogStats();
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
    return { blocks: [], warning: errorMessage(err) };
  }
}

// 발행 워크스페이스 라벨을 모르는 경로(export 자동 sync)용 — 각 워크스페이스 토큰을 차례로 시도.
// 기존에는 무조건 workspaces[0] 토큰이라 두 번째 워크스페이스 발행분이 조용히 skip 됐다.
export async function fetchPageContentAnyWorkspace(pageId: string): Promise<PageContent> {
  ensureEnvLoaded();
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
