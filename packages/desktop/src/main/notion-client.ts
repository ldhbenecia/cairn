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

export type RecentPage = {
  pageId: string;
  url: string;
  title: string;
  date: string | null;
  status: string | null;
  workspaceLabel: string;
};

type NotionWorkspaceConfig = {
  label: string;
  tokenEnv: string;
  worklog?: { dataSourceId?: string };
};

type ParsedConfig = {
  notionWorkspaces: NotionWorkspaceConfig[];
};

const PAGE_SIZE = 30;

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
    const dataSourceId = ws.worklog?.dataSourceId;
    if (!dataSourceId) {
      warnings.push(`${ws.label}: worklog.dataSourceId 없음`);
      continue;
    }

    try {
      const notion = new Client({ auth: token });
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: PAGE_SIZE,
        sorts: [{ property: 'Date', direction: 'descending' }],
      });
      for (const item of res.results) {
        if (!('properties' in item)) continue;
        const props = (item as { properties: Record<string, unknown> }).properties;
        const titleProp = props.Title as { title?: Array<{ plain_text?: string }> } | undefined;
        const dateProp = props.Date as { date?: { start?: string } | null } | undefined;
        const statusProp = props.Status as { select?: { name?: string } | null } | undefined;
        const url = (item as { url?: string }).url ?? '';
        allPages.push({
          pageId: item.id,
          url,
          title: titleProp?.title?.map((t) => t.plain_text ?? '').join('') ?? '(no title)',
          date: dateProp?.date?.start ?? null,
          status: statusProp?.select?.name ?? null,
          workspaceLabel: ws.label,
        });
      }
    } catch (err) {
      warnings.push(`${ws.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  allPages.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return { pages: allPages.slice(0, PAGE_SIZE), warnings };
}
