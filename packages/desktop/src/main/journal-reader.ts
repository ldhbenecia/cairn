import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readConfig } from './files';
import {
  listRecentPages,
  type PageContent,
  type RecentCategory,
  type RecentPage,
  type RecentWarning,
  type SimpleBlock,
  type WorklogSink,
} from './notion-client';
import { readSettings } from './settings';
import { buildExportIndex, exportIndexKey, journalFileNameFor } from './worklog-sinks';

export const JOURNAL_PAGE_PREFIX = 'journal:';
export const JOURNAL_WORKSPACE_LABEL = 'local';

const FILE_PATTERNS: { re: RegExp; category: RecentCategory }[] = [
  { re: /^\d{4}-\d{2}-\d{2}\.md$/, category: 'daily' },
  { re: /^\d{4}-W\d{2}\.md$/, category: 'weekly' },
  { re: /^\d{4}-\d{2}\.md$/, category: 'monthly' },
];

export async function journalFolder(): Promise<string> {
  const cfg = await readConfig();
  const parsed = cfg.parsed as { journal?: { folder?: string } } | null;
  const configured = parsed?.journal?.folder;
  if (!configured) return join(homedir(), 'Documents', 'Cairn Journal');
  // resolve() 는 '~' 를 확장하지 않는다 — cwd 아래 '~/...' 로 새는 것 방지
  const expanded = configured.startsWith('~/') ? join(homedir(), configured.slice(2)) : configured;
  return resolve(expanded);
}

export type JournalPage = RecentPage & { fileName: string; notionRef: string | null };

export async function listJournalPages(): Promise<JournalPage[]> {
  let names: string[];
  try {
    names = await readdir(await journalFolder());
  } catch {
    return [];
  }
  const targets = names
    .map((name) => ({ name, category: FILE_PATTERNS.find((p) => p.re.test(name))?.category }))
    .filter((t): t is { name: string; category: RecentCategory } => t.category !== undefined);

  const folder = await journalFolder();
  const pages = await Promise.all(
    targets.map(async ({ name, category }) => {
      try {
        const raw = await readFile(join(folder, name), 'utf8');
        return toJournalPage(name, category, raw);
      } catch {
        return null;
      }
    }),
  );
  return pages
    .filter((p): p is JournalPage => p !== null)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

// 목록은 journal(로컬)가 1차 — 노션에 이미 연동된 항목은 노션 쪽(상태·URL 보유)을 우선하고,
// 로컬 전용 항목(미연동·100건 cap 밖)만 journal 에서 추가한다
export async function listRecentMerged(): Promise<{
  pages: RecentPage[];
  warnings: RecentWarning[];
}> {
  const [notion, journal, exportIndex] = await Promise.all([
    listRecentPages(),
    listJournalPages(),
    readExportIndex(),
  ]);
  const notionIds = new Set(notion.pages.map((p) => p.pageId));
  const journalNames = new Set(journal.map((j) => j.fileName));
  const journalRefs = new Set(journal.flatMap((j) => (j.notionRef ? [j.notionRef] : [])));

  const withSinks = (page: RecentPage, inJournal: boolean, inNotion: boolean): RecentPage => {
    const sinks: WorklogSink[] = [];
    if (inJournal) sinks.push('journal');
    if (inNotion) sinks.push('notion');
    const key = page.date === null ? null : exportIndexKey(page.category, page.date);
    if (key !== null && exportIndex?.has(key)) sinks.push('obsidian');
    return { ...page, sinks };
  };

  const localOnly = journal.filter((v) => !(v.notionRef && notionIds.has(v.notionRef)));
  const pages = [
    ...localOnly.map(({ fileName: _f, notionRef, ...page }) =>
      withSinks(page, true, notionRef !== null),
    ),
    ...notion.pages.map((p) => {
      const name = p.date === null ? null : journalFileNameFor(p.category, p.date);
      return withSinks(
        p,
        journalRefs.has(p.pageId) || (name !== null && journalNames.has(name)),
        true,
      );
    }),
  ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  // journal 에 일지가 있으면 노션 미연동은 정상 상태 — 경고 배너를 띄우지 않는다
  const warnings =
    journal.length > 0
      ? notion.warnings.filter((w) => w.code !== 'no-workspaces')
      : notion.warnings;
  return { pages, warnings };
}

async function readExportIndex(): Promise<Set<string> | null> {
  const folder = readSettings().export.folder;
  if (!folder) return null;
  try {
    return buildExportIndex(await readdir(folder));
  } catch {
    return null;
  }
}

export async function readJournalPageContent(pageId: string): Promise<PageContent> {
  const fileName = pageId.slice(JOURNAL_PAGE_PREFIX.length);
  // pageId 는 renderer 에서 오므로 경로 조작 방지 — journal 파일명 패턴만 허용
  if (!FILE_PATTERNS.some((p) => p.re.test(fileName))) {
    return { blocks: [], warning: 'invalid journal page id' };
  }
  try {
    const raw = await readFile(join(await journalFolder(), fileName), 'utf8');
    return { blocks: markdownToBlocks(stripFrontmatter(raw).body) };
  } catch {
    return { blocks: [], warning: 'journal file read failed' };
  }
}

function toJournalPage(fileName: string, category: RecentCategory, raw: string): JournalPage {
  const { fm } = stripFrontmatter(raw);
  const num = (key: string): number | null => {
    const v = fm.get(key);
    if (v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const hoursRaw = fm.get('hours');
  const hours = hoursRaw
    ? hoursRaw
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    : null;
  return {
    pageId: `${JOURNAL_PAGE_PREFIX}${fileName}`,
    url: '',
    title: fm.get('title') ?? fileName.replace(/\.md$/, ''),
    date: fm.get('date') ?? null,
    status: null,
    category,
    pr: num('pr'),
    commit: num('commit'),
    hours: hours && hours.length === 24 ? hours : null,
    workspaceLabel: JOURNAL_WORKSPACE_LABEL,
    fileName,
    notionRef: fm.get('notion') ?? null,
  };
}

function stripFrontmatter(raw: string): { fm: Map<string, string>; body: string } {
  const fm = new Map<string, string>();
  // 외부 에디터가 CRLF 로 저장할 수 있다 — 파싱 전 정규화
  const text = raw.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return { fm, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { fm, body: text };
  for (const line of text.slice(4, end).split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value) as string;
      } catch {
        /* 원문 유지 */
      }
    }
    fm.set(key, value);
  }
  return { fm, body: text.slice(end + 5) };
}

// journal md 는 자체 생성물이라 구조가 한정적 — 헤딩·불릿·문단만 블록으로 변환
function markdownToBlocks(body: string): SimpleBlock[] {
  const blocks: SimpleBlock[] = [];
  let i = 0;
  for (const line of body.split('\n')) {
    const id = `journal-block-${i++}`;
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('# ')) {
      blocks.push({ id, type: 'heading_1', rich: [{ text: trimmed.slice(2) }] });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ id, type: 'heading_2', rich: [{ text: trimmed.slice(3) }] });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ id, type: 'heading_3', rich: [{ text: trimmed.slice(4) }] });
    } else if (trimmed.startsWith('- ')) {
      blocks.push({ id, type: 'bulleted_list_item', rich: [{ text: trimmed.slice(2) }] });
    } else {
      blocks.push({ id, type: 'paragraph', rich: [{ text: trimmed }] });
    }
  }
  return blocks;
}
