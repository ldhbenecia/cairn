import { describe, expect, it } from 'vitest';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import { buildRollupActivityPayload } from './rollup-tools.js';

const activity: RollupActivity = {
  period: 'weekly',
  rangeStart: '2026-05-04T00:00:00Z',
  rangeEnd: '2026-05-10T23:59:59Z',
  metrics: { prCount: 6, commitCount: 23, notionPageCount: 5, dailyCount: 5 },
  dailies: [
    {
      date: '2026-05-09',
      pageId: 'page-123',
      url: 'https://notion.so/page-123',
      prCount: 2,
      commitCount: 7,
      notionPageCount: 1,
    },
  ],
  summaries: [
    {
      date: '2026-05-09',
      paragraph: 'CairnError 통합과 Notion DB 스키마 작업을 진행함.',
      doneBullets: ['[cairn] CairnError 클래스 통합 (#13)'],
      reviewedBullets: [],
      inProgressBullets: ['[cairn] worklog DB 스키마 (#14)'],
      notesBullets: [],
    },
  ],
};

describe('buildRollupActivityPayload', () => {
  it('builds the expected shape from rollup activity', () => {
    const payload = buildRollupActivityPayload({ activity });
    expect(payload.period).toBe('weekly');
    expect(payload.metrics.prCount).toBe(6);
    expect(payload.dailies).toHaveLength(1);
    expect(payload.summaries[0]?.doneBullets).toEqual(['[cairn] CairnError 클래스 통합 (#13)']);
    expect(payload.sourceError).toBeUndefined();
  });

  it('clean payload passes the egress guard', () => {
    const payload = buildRollupActivityPayload({ activity });
    expect(() => assertNoForbiddenPayload(payload, 'test.rollup')).not.toThrow();
  });

  it('egress guard catches a forbidden pattern leaking through daily summary text', () => {
    const tainted: RollupActivity = {
      ...activity,
      summaries: [
        {
          ...activity.summaries[0]!,
          doneBullets: ['[cairn] dumped a diff: @@ -1,2 +1,2 @@ into the page'],
        },
      ],
    };
    const payload = buildRollupActivityPayload({ activity: tainted });
    expect(() => assertNoForbiddenPayload(payload, 'test.rollup-tainted')).toThrow(
      /unified-diff-hunk/,
    );
  });
});
