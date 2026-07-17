import { describe, expect, it } from 'vitest';
import type { RecentPage } from '../cairn-api';
import { availableYears, computeWrapped, longestStreak, topProjects } from './wrapped';

const daily = (date: string, pr: number, commit: number): RecentPage => ({
  pageId: `journal:${date}.md`,
  url: '',
  title: date,
  date,
  status: null,
  category: 'daily',
  pr,
  commit,
  hours: null,
  workspaceLabel: 'local',
});

describe('computeWrapped', () => {
  it('연도 필터·합계·월별 분포·최다 활동일', () => {
    const pages = [
      daily('2026-01-05', 2, 5),
      daily('2026-01-06', 1, 2),
      daily('2026-03-10', 0, 7),
      daily('2025-12-31', 9, 9),
    ];
    const w = computeWrapped(pages, '2026');
    expect([w.pr, w.commit, w.activeDays]).toEqual([3, 14, 3]);
    expect(w.byMonth[0]).toEqual({ pr: 3, commit: 7 });
    expect(w.byMonth[2]).toEqual({ pr: 0, commit: 7 });
    expect(w.busiestDay).toEqual({ date: '2026-01-05', total: 7 });
    expect(w.longestStreak).toBe(2);
  });
});

describe('longestStreak', () => {
  it('연속 구간의 최대 길이 (중복·역순 허용)', () => {
    expect(longestStreak(['2026-01-03', '2026-01-01', '2026-01-02', '2026-01-02'])).toBe(3);
    expect(longestStreak(['2026-02-28', '2026-03-01'])).toBe(2);
    expect(longestStreak([])).toBe(0);
  });
});

describe('topProjects', () => {
  it('[repo] 프리픽스 집계 — 계정 라벨이 앞에 붙으면 두 번째 사용', () => {
    const top = topProjects([
      '[cairn] 그래프 뷰',
      '[cairn] 캡처',
      '[work] [team-api] 청킹 수정',
      '프리픽스 없음',
    ]);
    expect(top).toEqual([
      { name: 'cairn', count: 2 },
      { name: 'team-api', count: 1 },
    ]);
  });
});

describe('availableYears', () => {
  it('daily 날짜의 연도 집합 최신순', () => {
    expect(availableYears([daily('2025-01-01', 1, 1), daily('2026-05-05', 1, 1)])).toEqual([
      '2026',
      '2025',
    ]);
  });
});
