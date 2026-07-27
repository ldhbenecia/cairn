import { beforeEach, describe, expect, it, vi } from 'vitest';

// broadcast 는 electron(BrowserWindow) 의존 — 진행 브로드캐스트 호출만 검증하도록 모킹
const broadcastMock = vi.fn();
vi.mock('./broadcast', () => ({
  broadcast: (ch: string, p: unknown): void => {
    broadcastMock(ch, p);
  },
}));

import {
  applyBackfillEvent,
  getBackfillCountsByDate,
  getBackfillLastPublishedDate,
  getBackfillPagesByDate,
  getRunProgress,
  resetBackfillTracking,
} from './core-runner-backfill';
import type { ParentEvent } from './core-runner-extract';

const ev = (e: ParentEvent): void => applyBackfillEvent(e, 'daily');
const PID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';

beforeEach(() => {
  resetBackfillTracking();
  broadcastMock.mockClear();
});

describe('applyBackfillEvent — 배치 진행 단일 소스 (ADR 0033 3단계)', () => {
  it('start→date-start→step→day-done→progress 흐름이 RunProgress 로 조립된다', () => {
    ev({ type: 'backfill-start', total: 3, dates: ['2026-07-01', '2026-07-02', '2026-07-03'] });
    ev({ type: 'backfill-date-start', date: '2026-07-01' });
    ev({ type: 'backfill-date-start', date: '2026-07-02' });
    ev({ type: 'date-step', date: '2026-07-01', step: 'summarize' });
    ev({ type: 'day-done', date: '2026-07-01', pr: 3, commit: 12, pageId: PID });
    ev({
      type: 'backfill-progress',
      done: 1,
      total: 3,
      doneDates: ['2026-07-01'],
      failedDates: [],
    });
    const p = getRunProgress();
    expect(p).toMatchObject({
      total: 3,
      done: 1,
      active: 1, // started 2 - done 1
      dates: ['2026-07-01', '2026-07-02', '2026-07-03'],
      doneDates: ['2026-07-01'],
      stepByDate: { '2026-07-01': 'summarize' },
      countsByDate: { '2026-07-01': { pr: 3, commit: 12 } },
    });
    expect(getBackfillPagesByDate()).toEqual({ '2026-07-01': PID });
    expect(getBackfillLastPublishedDate()).toBe('2026-07-01');
    expect(broadcastMock).toHaveBeenCalled();
    expect(broadcastMock.mock.lastCall?.[0]).toBe('cairn:run-progress');
  });

  it('멱등 — 중복·역순 이벤트가 진행을 되돌리지 않는다 (max·length 가드)', () => {
    ev({ type: 'backfill-start', total: 2, dates: ['2026-07-01', '2026-07-02'] });
    ev({
      type: 'backfill-progress',
      done: 2,
      total: 2,
      doneDates: ['2026-07-01', '2026-07-02'],
      failedDates: [],
    });
    // 뒤늦게 도착한 이전 진행 — done·doneDates 가 후퇴하면 안 됨
    ev({
      type: 'backfill-progress',
      done: 1,
      total: 2,
      doneDates: ['2026-07-01'],
      failedDates: [],
    });
    ev({ type: 'backfill-date-start', date: '2026-07-01' }); // 중복 start
    ev({ type: 'backfill-date-start', date: '2026-07-01' });
    expect(getRunProgress()).toMatchObject({ done: 2, doneDates: ['2026-07-01', '2026-07-02'] });
  });

  it('no-activity 는 0/0 카운트로 반영된다', () => {
    ev({ type: 'backfill-start', total: 2, dates: ['2026-07-01', '2026-07-02'] });
    ev({ type: 'no-activity', date: '2026-07-01' });
    expect(getBackfillCountsByDate()).toEqual({ '2026-07-01': { pr: 0, commit: 0 } });
  });

  it('단일 실행(total<=1)은 진행 브로드캐스트를 만들지 않지만 counts·page 는 집계된다', () => {
    ev({ type: 'day-done', date: '2026-07-25', pr: 2, commit: 5, pageId: null });
    expect(getRunProgress()).toBeNull();
    expect(broadcastMock).not.toHaveBeenCalled();
    // CoreResult 의 prCount/commitCount·발행 날짜는 단일 실행에서도 이 집계를 쓴다
    expect(getBackfillCountsByDate()).toEqual({ '2026-07-25': { pr: 2, commit: 5 } });
    expect(getBackfillLastPublishedDate()).toBe('2026-07-25');
  });

  it('reset 후 상태가 비워진다', () => {
    ev({ type: 'day-done', date: '2026-07-25', pr: 2, commit: 5, pageId: PID });
    resetBackfillTracking();
    expect(getRunProgress()).toBeNull();
    expect(getBackfillCountsByDate()).toEqual({});
    expect(getBackfillPagesByDate()).toEqual({});
    expect(getBackfillLastPublishedDate()).toBeNull();
  });
});
