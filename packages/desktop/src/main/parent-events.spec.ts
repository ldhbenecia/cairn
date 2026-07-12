import { describe, expect, it } from 'vitest';
import { applyParentEvent, createExtractor, parseParentEvent } from './core-runner-extract';

describe('parseParentEvent', () => {
  it('cairn 봉투 + 유효 타입만 이벤트로 인정한다', () => {
    expect(
      parseParentEvent({
        cairn: 1,
        type: 'publish-result',
        kind: 'created',
        pageId: 'p1',
        url: 'https://www.notion.so/x',
      }),
    ).toEqual({
      type: 'publish-result',
      kind: 'created',
      pageId: 'p1',
      url: 'https://www.notion.so/x',
    });
    expect(
      parseParentEvent({ cairn: 1, type: 'date-step', date: '2026-07-12', step: 'collect' }),
    ).toEqual({
      type: 'date-step',
      date: '2026-07-12',
      step: 'collect',
    });
  });

  it('백필 진행 이벤트(2단계)를 검증해 파싱한다', () => {
    expect(
      parseParentEvent({
        cairn: 1,
        type: 'backfill-start',
        total: 3,
        dates: ['2026-07-10', '2026-07-11'],
      }),
    ).toEqual({ type: 'backfill-start', total: 3, dates: ['2026-07-10', '2026-07-11'] });
    expect(
      parseParentEvent({
        cairn: 1,
        type: 'backfill-progress',
        done: 1,
        total: 3,
        doneDates: ['2026-07-10'],
        failedDates: [],
      }),
    ).toEqual({
      type: 'backfill-progress',
      done: 1,
      total: 3,
      doneDates: ['2026-07-10'],
      failedDates: [],
    });
    expect(
      parseParentEvent({
        cairn: 1,
        type: 'day-done',
        date: '2026-07-10',
        pr: 2,
        commit: 5,
        pageId: null,
      }),
    ).toEqual({ type: 'day-done', date: '2026-07-10', pr: 2, commit: 5, pageId: null });
    expect(
      parseParentEvent({ cairn: 1, type: 'backfill-start', total: 3, dates: ['nope'] }),
    ).toBeNull();
    expect(
      parseParentEvent({ cairn: 1, type: 'day-done', date: '2026-07-10', pr: '2', commit: 5 }),
    ).toBeNull();
  });

  it('봉투 없음·미지 타입·필드 타입 불일치는 버린다', () => {
    expect(parseParentEvent(null)).toBeNull();
    expect(parseParentEvent({ type: 'no-activity', date: '2026-07-12' })).toBeNull();
    expect(parseParentEvent({ cairn: 1, type: 'unknown-thing' })).toBeNull();
    expect(parseParentEvent({ cairn: 1, type: 'publish-result', kind: 'weird' })).toBeNull();
    expect(
      parseParentEvent({ cairn: 1, type: 'journal-written', fileName: 'not-md.txt' }),
    ).toBeNull();
    expect(
      parseParentEvent({ cairn: 1, type: 'date-step', date: '2026-07-12', step: 'boot' }),
    ).toBeNull();
  });
});

describe('applyParentEvent', () => {
  it('publish-result·journal·no-activity·summary-failed 를 extractor 상태에 반영한다', () => {
    const state = createExtractor();
    applyParentEvent(state, { type: 'publish-result', kind: 'created', pageId: 'p1', url: 'u1' });
    applyParentEvent(state, { type: 'journal-written', fileName: '2026-07-12.md' });
    applyParentEvent(state, { type: 'journal-write-failed' });
    applyParentEvent(state, { type: 'no-activity', date: '2026-07-12' });
    applyParentEvent(state, { type: 'summary-failed', date: '2026-07-12' });
    expect(state.lastKind).toBe('created');
    expect(state.lastPageId).toBe('p1');
    expect(state.lastUrl).toBe('u1');
    expect(state.lastJournalFile).toBe('2026-07-12.md');
    expect(state.journalWriteFailed).toBe(true);
    expect(state.noActivity).toBe(true);
    expect(state.summaryFailed).toBe(true);
  });

  it('date-step 은 상태 대신 브로드캐스트할 step 을 돌려준다', () => {
    const state = createExtractor();
    expect(
      applyParentEvent(state, { type: 'date-step', date: '2026-07-12', step: 'summarize' }),
    ).toBe('summarize');
  });

  it('skipped(no-target) 결과의 null pageId/url 은 기존 값을 지우지 않는다', () => {
    const state = createExtractor();
    applyParentEvent(state, { type: 'publish-result', kind: 'created', pageId: 'p1', url: 'u1' });
    applyParentEvent(state, { type: 'publish-result', kind: 'skipped', pageId: null, url: null });
    expect(state.lastKind).toBe('skipped');
    expect(state.lastPageId).toBe('p1');
    expect(state.lastUrl).toBe('u1');
  });
});
