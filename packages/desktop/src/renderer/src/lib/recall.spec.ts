import { describe, expect, it } from 'vitest';
import type { RecentPage } from '../cairn-api';
import { recallDates, recallEntries } from './recall';

const page = (date: string, category: RecentPage['category'] = 'daily'): RecentPage => ({
  pageId: `id-${category}-${date}`,
  url: '',
  title: `${date} 작업 일지`,
  date,
  status: null,
  category,
  pr: 3,
  commit: 12,
  hours: null,
  workspaceLabel: 'local',
});

describe('recallDates — 1주/1달/1년 전 날짜 산술', () => {
  it('평범한 날짜', () => {
    expect(recallDates('2026-07-25')).toEqual([
      { key: 'week', date: '2026-07-18' },
      { key: 'month', date: '2026-06-25' },
      { key: 'year', date: '2025-07-25' },
    ]);
  });

  it('월 이동 말일 클램프 — 07-31 의 한 달 전은 06-30', () => {
    const dates = recallDates('2026-07-31');
    expect(dates.find((d) => d.key === 'month')!.date).toBe('2026-06-30');
  });

  it('03-31 의 한 달 전은 평년 02-28, 윤년이면 02-29', () => {
    expect(recallDates('2026-03-31').find((d) => d.key === 'month')!.date).toBe('2026-02-28');
    expect(recallDates('2028-03-31').find((d) => d.key === 'month')!.date).toBe('2028-02-29');
  });

  it('윤일의 1년 전은 평년 02-28 로 클램프', () => {
    expect(recallDates('2028-02-29').find((d) => d.key === 'year')!.date).toBe('2027-02-28');
  });

  it('연초 주 이동은 전년으로 넘어간다', () => {
    expect(recallDates('2026-01-03').find((d) => d.key === 'week')!.date).toBe('2025-12-27');
  });
});

describe('recallEntries — 일간 일지 매칭', () => {
  it('해당 날짜의 daily 만 매칭, 없는 시점은 드롭', () => {
    const pages = [page('2026-07-18'), page('2025-07-25')];
    const entries = recallEntries(pages, '2026-07-25');
    expect(entries.map((e) => [e.key, e.date])).toEqual([
      ['week', '2026-07-18'],
      ['year', '2025-07-25'],
    ]);
  });

  it('weekly/monthly 는 무시 — daily 만', () => {
    const pages = [page('2026-07-18', 'weekly'), page('2026-06-25', 'monthly')];
    expect(recallEntries(pages, '2026-07-25')).toEqual([]);
  });

  it('셋 다 없으면 빈 배열 (카드 숨김 근거)', () => {
    expect(recallEntries([page('2026-07-01')], '2026-07-25')).toEqual([]);
  });
});
