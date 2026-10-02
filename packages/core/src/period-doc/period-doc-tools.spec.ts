import { describe, expect, it } from 'vitest';
import {
  buildPeriodDocPayload,
  periodDocFileName,
  renderPeriodDocMarkdown,
  submitPeriodDocSchema,
} from './period-doc-tools.js';

const metrics = { journalCount: 3, prCount: 5, commitCount: 12 };

describe('buildPeriodDocPayload', () => {
  it('drops only the bullets carrying forbidden patterns and empty days', () => {
    const { payload, dropped } = buildPeriodDocPayload({
      rangeStart: '2026-07-01',
      rangeEnd: '2026-07-31',
      metrics,
      days: [
        {
          date: '2026-07-01',
          done: ['[cairn] 퀵 캡처 — ⌘⇧Space', '[cairn] 경로 /Users/someone/x 정리'],
        },
        { date: '2026-07-02', done: ['```ts\nconst a = 1\n```'] },
        { date: '2026-07-03', done: [] },
      ],
    });
    expect(dropped).toBe(2);
    expect(payload.days).toEqual([{ date: '2026-07-01', done: ['[cairn] 퀵 캡처 — ⌘⇧Space'] }]);
    expect(payload.metrics).toEqual(metrics);
  });
});

describe('renderPeriodDocMarkdown', () => {
  it('renders frontmatter, deterministic totals and one section per project', () => {
    const md = renderPeriodDocMarkdown({
      since: '2026-07-01',
      until: '2026-09-30',
      lang: 'ko',
      metrics,
      model: 'claude-haiku-4-5',
      submission: {
        overview: '일지 3개 · PR 5 · 커밋 12.',
        projects: [
          { name: 'cairn', summary: '로컬 우선 전환.', items: ['퀵 캡처 —\n⌘⇧Space'] },
          { name: '기타', items: ['문서 정리'] },
        ],
      },
    });
    expect(md).toContain('since: 2026-07-01\nuntil: 2026-09-30\n');
    expect(md).toContain('# 기간 정리 2026-07-01 – 2026-09-30\n\n일지 3 · PR 5 · 커밋 12\n');
    expect(md).toContain('## cairn\n\n로컬 우선 전환.\n\n- 퀵 캡처 — ⌘⇧Space\n');
    expect(md).toContain('## 기타\n\n- 문서 정리\n');
    expect(md).toContain('model: claude-haiku-4-5\n');
  });

  it('keeps only the repo when the model copies the bullet brackets into the name', () => {
    const md = renderPeriodDocMarkdown({
      since: '2026-08-01',
      until: '2026-09-30',
      lang: 'ko',
      metrics,
      submission: {
        overview: 'x',
        projects: [
          { name: '[backend-donghyeok] [CashwalkBackend]', items: ['a'] },
          { name: '[cairn]', items: ['b'] },
        ],
      },
    });
    expect(md).toContain('## CashwalkBackend\n');
    expect(md).toContain('## cairn\n');
  });

  it('uses English labels for en', () => {
    const md = renderPeriodDocMarkdown({
      since: '2026-07-01',
      until: '2026-07-31',
      lang: 'en',
      metrics,
      submission: { overview: 'x', projects: [{ name: 'cairn', items: ['y'] }] },
    });
    expect(md).toContain(
      '# Period summary 2026-07-01 – 2026-07-31\n\n3 worklogs · 5 PRs · 12 commits\n',
    );
    expect(md).toContain('## Overview\n');
    expect(md).not.toContain('model:');
  });
});

describe('submitPeriodDocSchema', () => {
  it('rejects a project without items', () => {
    expect(() =>
      submitPeriodDocSchema.parse({ overview: 'x', projects: [{ name: 'cairn', items: [] }] }),
    ).toThrow();
  });
});

describe('periodDocFileName', () => {
  it('joins the range', () => {
    expect(periodDocFileName('2026-07-01', '2026-09-30')).toBe('2026-07-01_2026-09-30.md');
  });
});
