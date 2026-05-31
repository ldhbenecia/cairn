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
  sourceCounts: string | null;
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

function readRichText(props: Record<string, unknown>, key: string): string | null {
  const p = props[key] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  return p?.rich_text?.map((t) => t.plain_text ?? '').join('') || null;
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

  const allPages: RecentPage[] = [];
  const warnings: string[] = [];

  for (const ws of parsed.notionWorkspaces) {
    const token = process.env[ws.tokenEnv];
    if (!token) {
      warnings.push(`${ws.label}: token env "${ws.tokenEnv}" 없음`);
      continue;
    }
    const notion = new Client({ auth: token });

    const worklogDs = ws.worklog?.dataSourceId;
    if (!worklogDs) {
      warnings.push(`${ws.label}: worklog.dataSourceId 없음`);
    } else {
      try {
        const res = await notion.dataSources.query({
          data_source_id: worklogDs,
          page_size: PAGE_SIZE,
          sorts: [{ property: 'Date', direction: 'descending' }],
        });
        for (const item of res.results) {
          if (!('properties' in item)) continue;
          const { properties: props, url } = item as NotionPageItem;
          allPages.push({
            pageId: item.id,
            url: url ?? '',
            title: readTitle(props),
            date: readDate(props, 'Date'),
            status: readSelect(props, 'Status'),
            category: 'daily',
            sourceCounts: readRichText(props, 'Source counts'),
            workspaceLabel: ws.label,
          });
        }
      } catch (err) {
        warnings.push(`${ws.label} (worklog): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const rollupDs = ws.rollup?.dataSourceId;
    if (rollupDs) {
      try {
        const res = await notion.dataSources.query({
          data_source_id: rollupDs,
          page_size: PAGE_SIZE,
          sorts: [{ property: 'Range end', direction: 'descending' }],
        });
        for (const item of res.results) {
          if (!('properties' in item)) continue;
          const { properties: props, url } = item as NotionPageItem;
          allPages.push({
            pageId: item.id,
            url: url ?? '',
            title: readTitle(props),
            date: readDate(props, 'Range end') ?? readDate(props, 'Range start'),
            status: readSelect(props, 'Status'),
            category: readSelect(props, 'Period') === 'monthly' ? 'monthly' : 'weekly',
            sourceCounts: readRichText(props, 'Source counts'),
            workspaceLabel: ws.label,
          });
        }
      } catch (err) {
        warnings.push(`${ws.label} (rollup): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  allPages.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { pages: allPages.slice(0, PAGE_SIZE), warnings };
}
