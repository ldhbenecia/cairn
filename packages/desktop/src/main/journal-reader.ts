import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readConfig } from './files';
import { FILE_PATTERNS, journalFileCategory, stripFrontmatter } from './journal-files';
import { searchJournals, type JournalSearchHit } from './journal-search';
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

export async function journalFolder(): Promise<string> {
  const cfg = await readConfig();
  const parsed = cfg.parsed as { journal?: { folder?: string } } | null;
  const configured = parsed?.journal?.folder;
  if (!configured) return join(homedir(), 'Documents', 'Cairn Journal');
  // resolve() 는 '~' 를 확장하지 않음 — cwd 아래 '~/...' 로 새는 것 방지
  const expanded = configured.startsWith('~/') ? join(homedir(), configured.slice(2)) : configured;
  return resolve(expanded);
}

export type JournalPage = RecentPage & { fileName: string; notionRef: string | null };

// 목록(포커스·run-done 마다)과 검색(입력 디바운스마다)이 매번 전 파일을 읽던 것 — stat 으로 바뀐 파일만 다시 읽음
// 파일당 수 KB 라 수백 개여도 메모리 부담 작음
const textCache = new Map<string, { mtimeMs: number; size: number; text: string }>();

async function readJournalText(path: string): Promise<string> {
  const st = await stat(path);
  const hit = textCache.get(path);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.text;
  const text = await readFile(path, 'utf8');
  textCache.set(path, { mtimeMs: st.mtimeMs, size: st.size, text });
  return text;
}

// 폴더의 journal 파일만 — 사라진 파일·다른 폴더의 캐시는 함께 정리
async function journalTargets(): Promise<{
  folder: string;
  targets: { name: string; category: RecentCategory }[];
} | null> {
  const folder = await journalFolder();
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return null;
  }
  const targets = names
    .map((name) => ({ name, category: journalFileCategory(name) }))
    .filter((t): t is { name: string; category: RecentCategory } => t.category !== undefined);
  const live = new Set(targets.map((t) => join(folder, t.name)));
  for (const key of textCache.keys()) if (!live.has(key)) textCache.delete(key);
  return { folder, targets };
}

export async function listJournalPages(): Promise<JournalPage[]> {
  const found = await journalTargets();
  if (!found) return [];
  const { folder, targets } = found;
  const pages = await Promise.all(
    targets.map(async ({ name, category }) => {
      try {
        return toJournalPage(name, category, await readJournalText(join(folder, name)));
      } catch {
        return null;
      }
    }),
  );
  return pages
    .filter((p): p is JournalPage => p !== null)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

// 목록은 journal 이 1차 — 노션에 연동된 항목은 노션(상태·URL 보유) 우선,
// 로컬 전용 항목(미연동·100건 cap 밖)만 journal 에서 추가
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
  // notionRef 없는 구버전 journal 이어도 같은 category+date 노션 페이지가 있으면 중복 행 방지
  // 로컬 journal 은 날짜당 1파일이라 워크스페이스 무관 판단이 안전
  const notionCatDates = new Set(
    notion.pages.flatMap((p) => (p.date === null ? [] : [`${p.category}|${p.date}`])),
  );

  const withSinks = (page: RecentPage, inJournal: boolean, inNotion: boolean): RecentPage => {
    const sinks: WorklogSink[] = [];
    if (inJournal) sinks.push('journal');
    if (inNotion) sinks.push('notion');
    const key = page.date === null ? null : exportIndexKey(page.category, page.date);
    if (key !== null && exportIndex?.has(key)) sinks.push('obsidian');
    return { ...page, sinks };
  };

  const localOnly = journal.filter(
    (v) =>
      !(v.notionRef && notionIds.has(v.notionRef)) &&
      !(v.date !== null && notionCatDates.has(`${v.category}|${v.date}`)),
  );
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
  return { pages, warnings: notion.warnings };
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

// journal 폴더의 패턴 일치 md 전문을 읽어 순수 매칭에 넘김 — 디바운스 뒤 호출이라 전문 읽기 허용
// frontmatter 는 제외해 날짜·notion 메타 오매칭 방지, 외부 송신 없음
export async function searchJournalContents(query: string): Promise<JournalSearchHit[]> {
  if (query.trim().length < 2) return [];
  const found = await journalTargets();
  if (!found) return [];
  const { folder, targets } = found;
  const files = await Promise.all(
    targets.map(async ({ name, category }) => {
      try {
        const raw = await readJournalText(join(folder, name));
        return { fileName: name, category, body: stripFrontmatter(raw).body };
      } catch {
        return null;
      }
    }),
  );
  return searchJournals(
    files.filter((f): f is NonNullable<typeof f> => f !== null),
    query,
  );
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

// journal md 는 자체 생성물이라 헤딩·불릿·문단만 블록으로 변환
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
