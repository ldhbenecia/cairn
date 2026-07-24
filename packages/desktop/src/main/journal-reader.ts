import { open, readdir, readFile } from 'node:fs/promises';
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

// FILE_PATTERNS·stripFrontmatter 는 journal-files.ts(순수 모듈)로 분리 — 검색 스펙과 공유

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
        // 목록은 frontmatter 만 쓰므로 파일 head(4KB)만 읽는다 — 본문까지 읽으면
        // journal 이 수백 개일 때 목록 조회마다 불필요한 전문 I/O
        const path = join(folder, name);
        let text = await readFileHead(path, 4096);
        // 외부 에디터(Obsidian 등)가 frontmatter 를 4KB 이상으로 키우면 종료 마커가 head 밖으로
        // 밀려 메타가 통째 유실됨 — 그 경우만 전문을 다시 읽어 정확성 보장 (드문 경로)
        if (text.startsWith('---\n') && text.indexOf('\n---\n', 4) === -1) {
          text = await readFile(path, 'utf8');
        }
        return toJournalPage(name, category, text);
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
  // notionRef 미기록(구버전 journal 등)이어도 같은 category+date 노션 페이지가 있으면 중복 행 방지
  // 로컬 journal 은 날짜당 1파일이라 워크스페이스 무관 date+category 로 판단해도 안전
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

// 일지 본문 검색 — journal 폴더의 패턴 일치 md 전문을 읽어 순수 매칭(journal-search)에 넘긴다.
// 검색은 사용자 발화형(디바운스 뒤 호출)이라 목록의 head-only 최적화와 달리 전문을 읽어도 되고,
// frontmatter 는 제외해 날짜·notion 메타에 오매칭하지 않는다. 완전 로컬 — 외부 송신 없음
export async function searchJournalContents(query: string): Promise<JournalSearchHit[]> {
  if (query.trim().length < 2) return [];
  const folder = await journalFolder();
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return [];
  }
  const targets = names
    .map((name) => ({ name, category: journalFileCategory(name) }))
    .filter((t): t is { name: string; category: RecentCategory } => t.category !== undefined);
  const files = await Promise.all(
    targets.map(async ({ name, category }) => {
      try {
        const raw = await readFile(join(folder, name), 'utf8');
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

// 파일 앞 N 바이트만 읽는다 — frontmatter(작은 고정 필드) 파싱용. 경계에서 멀티바이트가
// 잘려도 frontmatter 종료(\n---\n)는 head 안에 있어 파싱에 영향 없음
async function readFileHead(path: string, bytes: number): Promise<string> {
  const fh = await open(path, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
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
