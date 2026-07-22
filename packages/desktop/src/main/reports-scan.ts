import { doneBullets } from './done-bullets';
import { JOURNAL_PAGE_PREFIX, readJournalPageContent } from './journal-reader';
import { fetchPageContent, type PageContent, type RecentCategory } from './notion-client';
import { journalFileNameFor } from './worklog-sinks';

export type ReportsDoneRef = {
  pageId: string;
  workspaceLabel: string;
  date: string | null;
  category: RecentCategory;
};
export type ReportsDoneResult = { pageId: string; bullets: string[]; failed: boolean };

// 로컬 journal / Notion 라우팅 — page-content 핸들러(뷰어)가 쓴다. pageId 접두사로 판단
export function readPageBlocks(pageId: string, workspaceLabel: string): Promise<PageContent> {
  return pageId.startsWith(JOURNAL_PAGE_PREFIX)
    ? readJournalPageContent(pageId)
    : fetchPageContent(pageId, workspaceLabel);
}

// 스캔용 — 노션 pageId 라도 같은 날짜의 로컬 journal 파일이 있으면 그걸 우선 읽는다. 로컬은
// 발행의 원본이라 Done 내용이 동일하고, 네트워크 왕복을 통째로 없앤다. 없을 때만 노션 폴백.
// (뷰어의 readPageBlocks 와 달리 스캔은 식별자·캐시 키는 그대로 두고 읽는 소스만 로컬로 바꾼다)
async function readForScan(ref: ReportsDoneRef): Promise<PageContent> {
  if (ref.pageId.startsWith(JOURNAL_PAGE_PREFIX)) return readJournalPageContent(ref.pageId);
  if (ref.date !== null) {
    const name = journalFileNameFor(ref.category, ref.date);
    if (name !== null) {
      const local = await readJournalPageContent(`${JOURNAL_PAGE_PREFIX}${name}`);
      if (local.warning == null) return local; // 로컬 파일 존재 → 로컬 사용
    }
  }
  return fetchPageContent(ref.pageId, ref.workspaceLabel);
}

// 프로젝트 뷰 스캔용 — 여러 페이지의 Done 불릿만 반환한다. 전체 blocks 를 IPC 로 넘기지 않아
// 페이로드가 작고, 로컬 파일이 있으면 노션을 안 때린다. 본문 조회 실패(warning + 빈 blocks)는
// failed 로 표시해 캐시에 고착되지 않게 한다
export async function scanReportsDone(refs: ReportsDoneRef[]): Promise<ReportsDoneResult[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const c = await readForScan(ref);
      const failed = c.warning != null && c.blocks.length === 0;
      return { pageId: ref.pageId, bullets: failed ? [] : doneBullets(c.blocks), failed };
    }),
  );
}
