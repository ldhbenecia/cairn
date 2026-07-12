import { describe, expect, it } from 'vitest';
import { buildExportTargets } from './export-targets';

const base = {
  fallbackDate: '2026-07-12',
  lastPageId: null as string | null,
  lastJournalFile: null as string | null,
  countsByDate: {} as Record<string, { pr: number; commit: number }>,
  pagesByDate: {} as Record<string, string>,
};

describe('buildExportTargets', () => {
  it('daily 배치 — 활동 있는 날짜 전부, no-activity(0/0) 제외', () => {
    const targets = buildExportTargets({
      ...base,
      mode: 'daily',
      countsByDate: {
        '2026-07-10': { pr: 1, commit: 3 },
        '2026-07-11': { pr: 0, commit: 0 },
        '2026-07-12': { pr: 2, commit: 0 },
      },
      pagesByDate: { '2026-07-10': 'page-a' },
    });
    expect(targets.map((t) => t.date)).toEqual(['2026-07-10', '2026-07-12']);
    expect(targets[0]).toEqual({
      category: 'daily',
      date: '2026-07-10',
      fileBase: '2026-07-10',
      pageId: 'page-a',
    });
    expect(targets[1]!.pageId).toBeNull();
  });

  it('daily 단건 폴백 — counts 추출이 안 됐어도 journal 파일이 있으면 대상 생성', () => {
    const targets = buildExportTargets({
      ...base,
      mode: 'daily',
      lastJournalFile: '2026-07-12.md',
    });
    expect(targets).toEqual([
      { category: 'daily', date: '2026-07-12', fileBase: '2026-07-12', pageId: null },
    ]);
  });

  it('소스가 아무것도 없으면(페이지도 journal 도) 빈 목록', () => {
    expect(buildExportTargets({ ...base, mode: 'daily' })).toEqual([]);
    expect(buildExportTargets({ ...base, mode: 'weekly' })).toEqual([]);
  });

  it('rollup — 기간 라벨 fileBase, 로컬 온리(journal만)도 대상 생성', () => {
    const targets = buildExportTargets({
      ...base,
      mode: 'weekly',
      lastJournalFile: '2026-W28.md',
    });
    expect(targets).toEqual([
      { category: 'weekly', date: '2026-07-12', fileBase: '2026-07-12-weekly', pageId: null },
    ]);
  });
});
