import { describe, expect, it } from 'vitest';
import { assertNoForbiddenPayload } from '../common/sanitize.js';
import type { RollupActivity } from '../contracts/rollup-activity.types.js';
import {
  buildRollupActivityPayload,
  dropForbiddenSummaries,
  submitRollupSchema,
} from './rollup-tools.js';

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

describe('submitRollupSchema paragraph 상한', () => {
  it('2000자는 통과, 2001자는 거부 — Notion rich_text 한도 정합', () => {
    const base = { themes: [], highlights: [] };
    expect(submitRollupSchema.safeParse({ ...base, paragraph: 'a'.repeat(2000) }).success).toBe(
      true,
    );
    expect(submitRollupSchema.safeParse({ ...base, paragraph: 'a'.repeat(2001) }).success).toBe(
      false,
    );
  });
});

describe('dropForbiddenSummaries', () => {
  const clean = {
    date: '2026-07-01',
    paragraph: '정상 요약',
    doneBullets: ['작업 A'],
    reviewedBullets: [],
    inProgressBullets: [],
    notesBullets: [],
  };
  const dirty = {
    ...clean,
    date: '2026-07-02',
    notesBullets: ['고객 문의 foo@bar.com 회신'],
  };

  it('위반 항목만 날짜 단위로 drop 하고 나머지는 보존', () => {
    const dropped: string[] = [];
    const safe = dropForbiddenSummaries([clean, dirty], (d) => dropped.push(d));
    expect(safe.map((s) => s.date)).toEqual(['2026-07-01']);
    expect(dropped).toEqual(['2026-07-02']);
  });

  it('전부 정상이면 그대로 통과', () => {
    const safe = dropForbiddenSummaries([clean], () => {
      throw new Error('should not drop');
    });
    expect(safe).toHaveLength(1);
  });
});
