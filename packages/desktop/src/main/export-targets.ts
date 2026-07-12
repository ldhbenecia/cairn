export type ExportTarget = {
  category: 'daily' | 'weekly' | 'monthly';
  date: string;
  fileBase: string;
  pageId: string | null;
};

// export sync 대상 산정 — 노션 pageId 에 의존하지 않는다 (로컬 온리 발행에서 autoSync 가
// 무동작이던 문제). daily 배치는 활동이 있어 발행된 날짜 전부, rollup 은 기간 라벨 파일 하나.
export function buildExportTargets(input: {
  mode: 'daily' | 'weekly' | 'monthly';
  fallbackDate: string;
  lastPageId: string | null;
  lastJournalFile: string | null;
  countsByDate: Record<string, { pr: number; commit: number }>;
  pagesByDate: Record<string, string>;
}): ExportTarget[] {
  if (input.mode !== 'daily') {
    // 노션 페이지든 journal 이든 하나는 있어야 sync 할 소스가 있다
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
  // countsByDate 는 'daily: publish done' 에서만 채워진다 — 활동 0(no-activity) 날짜 제외
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
