export type ExportTarget = {
  category: 'daily' | 'weekly' | 'monthly';
  date: string;
  fileBase: string;
  pageId: string | null;
};

// export 대상 산정 — 노션 pageId 에 의존하지 않는다 (로컬 온리 autoSync)
export function buildExportTargets(input: {
  mode: 'daily' | 'weekly' | 'monthly';
  fallbackDate: string;
  lastPageId: string | null;
  lastJournalFile: string | null;
  countsByDate: Record<string, { pr: number; commit: number }>;
  pagesByDate: Record<string, string>;
}): ExportTarget[] {
  if (input.mode !== 'daily') {
    if (!input.lastPageId && !input.lastJournalFile) return [];
    return [
      {
        category: input.mode,
        date: input.fallbackDate,
        fileBase: `${input.fallbackDate}-${input.mode}`,
        pageId: input.lastPageId,
      },
    ];
  }
  // countsByDate 는 발행 완료 날짜만 담긴다 — no-activity 제외
  const active = Object.entries(input.countsByDate).filter(([, c]) => c.pr + c.commit > 0);
  if (active.length > 0) {
    return active.map(([date]) => ({
      category: 'daily' as const,
      date,
      fileBase: date,
      pageId: input.pagesByDate[date] ?? null,
    }));
  }
  if (!input.lastPageId && !input.lastJournalFile) return [];
  return [
    {
      category: 'daily' as const,
      date: input.fallbackDate,
      fileBase: input.fallbackDate,
      pageId: input.lastPageId,
    },
  ];
}
