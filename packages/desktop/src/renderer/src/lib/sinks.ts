import type { RecentPage, WorklogSink } from '../cairn-api';

// 구버전 로컬 캐시에는 sinks 가 없음 — 출처 라벨로 유추
export function pageSinks(page: RecentPage): WorklogSink[] {
  return page.sinks ?? (page.workspaceLabel === 'local' ? ['journal'] : ['notion']);
}

export function sinkLabel(sink: WorklogSink, page: RecentPage, journalLabel: string): string {
  if (sink === 'journal') return journalLabel;
  if (sink === 'notion') {
    return page.workspaceLabel === 'local' ? 'Notion' : `Notion (${page.workspaceLabel})`;
  }
  return 'Obsidian';
}
