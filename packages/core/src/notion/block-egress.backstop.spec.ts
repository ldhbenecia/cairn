import { describe, expect, it, vi } from 'vitest';

// 교차 블록 패턴은 콘텐츠만으로는 구성 불가(블록 사이에 JSON 구조 문자가 끼어 정규식이 경계를
// 못 넘음) — 통짜 검사(label 원형)만 실패하도록 sanitize 를 스텁해 백스톱 분기를 회귀 고정한다.
vi.mock('../common/sanitize.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../common/sanitize.js')>();
  return {
    ...actual,
    assertNoForbiddenPayload: (payload: unknown, label: string): void => {
      if (label === 'test') throw new Error(`sanitize.${label}: forbidden pattern 'x' matched`);
      actual.assertNoForbiddenPayload(payload, label);
    },
  };
});

import { enforceBlockEgress } from './block-egress.js';
import { claudeCallout, paragraph } from './notion-blocks.js';

describe('enforceBlockEgress — 교차 블록 백스톱', () => {
  it('블록 개별은 통과해도 생존 셋 통짜 검사에 걸리면 fallback 으로 degrade', () => {
    const logger = { warn: vi.fn() };
    const fallback = [claudeCallout('fallback')];
    const blocks = [paragraph('clean one'), paragraph('clean two')];

    const out = enforceBlockEgress(blocks, () => fallback, 'test', logger);

    expect(out).toEqual(fallback);
    expect(
      logger.warn.mock.calls.some(([, msg]) => String(msg).includes('degrading to fallback')),
    ).toBe(true);
  });
});
