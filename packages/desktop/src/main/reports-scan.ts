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

// pageId 접두사로 로컬 journal / Notion 라우팅 — page-content 핸들러(뷰어)용
export function readPageBlocks(pageId: string, workspaceLabel: string): Promise<PageContent> {
  return pageId.startsWith(JOURNAL_PAGE_PREFIX)
    ? readJournalPageContent(pageId)
    : fetchPageContent(pageId, workspaceLabel);
}

// 스캔은 노션 pageId 라도 같은 날짜 로컬 journal 이 있으면 우선 — 발행 원본이라 Done 이 같고 네트워크 왕복 제거
// 뷰어와 달리 식별자·캐시 키는 그대로 두고 읽는 소스만 로컬로
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

// 여러 페이지의 Done 불릿만 반환해 IPC 페이로드 최소화 — 본문 조회 실패(warning + 빈 blocks)는
// failed 로 표시해 캐시에 고착되지 않게
export async function scanReportsDone(refs: ReportsDoneRef[]): Promise<ReportsDoneResult[]> {
  return Promise.all(
    refs.map(async (ref) => {
      const c = await readForScan(ref);
      const failed = c.warning != null && c.blocks.length === 0;
      return { pageId: ref.pageId, bullets: failed ? [] : doneBullets(c.blocks), failed };
    }),
  );
}
