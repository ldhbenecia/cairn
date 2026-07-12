import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitParentEvent } from './parent-events.js';

describe('emitParentEvent', () => {
  afterEach(() => {
    delete (process as { send?: unknown }).send;
  });

  it('process.send 가 있으면 cairn 봉투로 전송한다', () => {
    const send = vi.fn().mockReturnValue(true);
    (process as { send?: unknown }).send = send;
    emitParentEvent({ type: 'no-activity', date: '2026-07-12' });
    expect(send).toHaveBeenCalledWith({ cairn: 1, type: 'no-activity', date: '2026-07-12' });
  });

  it('process.send 가 없으면(CLI 단독 실행) 조용히 no-op', () => {
    expect(() => emitParentEvent({ type: 'journal-write-failed' })).not.toThrow();
  });

  it('send 가 던져도 전파하지 않는다 (best-effort)', () => {
    (process as { send?: unknown }).send = vi.fn().mockImplementation(() => {
      throw new Error('channel closed');
    });
    expect(() =>
      emitParentEvent({ type: 'journal-written', fileName: '2026-07-12.md' }),
    ).not.toThrow();
  });
});
