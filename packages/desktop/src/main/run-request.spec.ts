import { describe, expect, it } from 'vitest';
import { parseRunRequest } from './run-request';

describe('parseRunRequest', () => {
  it('정상 요청은 그대로 통과', () => {
    const opts = { backfillDays: 3, force: true, date: '2026-10-02', skipNotion: true };
    expect(parseRunRequest('daily', opts)).toEqual(['daily', opts]);
  });

  it('모르는 모드는 거부', () => {
    expect(() => parseRunRequest('hourly', {})).toThrow('invalid mode');
    expect(() => parseRunRequest(undefined, {})).toThrow('invalid mode');
  });

  it('형식이 틀린 옵션·모르는 필드는 버림', () => {
    expect(
      parseRunRequest('weekly', {
        backfillDays: -1,
        force: 'yes',
        date: '2026-10-02 --skip-notion',
        skipNotion: 1,
        extra: 'x',
      }),
    ).toEqual(['weekly', {}]);
    expect(parseRunRequest('monthly', { backfillDays: 1.5 })).toEqual(['monthly', {}]);
  });

  it('옵션 생략·null 은 빈 옵션', () => {
    expect(parseRunRequest('yearly', undefined)).toEqual(['yearly', {}]);
    expect(parseRunRequest('yearly', null)).toEqual(['yearly', {}]);
  });
});
