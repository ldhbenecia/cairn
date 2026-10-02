import { describe, expect, it } from 'vitest';
import { parsePeriodDoc, presetRange, rangeProblem } from './period-doc';

describe('presetRange', () => {
  it('counts today inclusively', () => {
    expect(presetRange('1m', '2026-10-02')).toEqual({ since: '2026-09-03', until: '2026-10-02' });
    expect(presetRange('1y', '2026-10-02')).toEqual({ since: '2025-10-03', until: '2026-10-02' });
  });

  it('ytd starts on Jan 1', () => {
    expect(presetRange('ytd', '2026-10-02')).toEqual({ since: '2026-01-01', until: '2026-10-02' });
  });

  it('every preset is within the max span', () => {
    for (const p of ['1m', '3m', '6m', 'ytd', '1y'] as const) {
      expect(rangeProblem(presetRange(p, '2028-12-31'))).toBeNull();
    }
  });
});

describe('rangeProblem', () => {
  it('flags reversed and over-long ranges', () => {
    expect(rangeProblem({ since: '2026-07-02', until: '2026-07-01' })).toBe('reversed');
    expect(rangeProblem({ since: '2026-01-01', until: '2027-01-02' })).toBe('too-long');
    expect(rangeProblem({ since: '2028-01-01', until: '2028-12-31' })).toBeNull();
  });
});

describe('parsePeriodDoc', () => {
  it('drops frontmatter and title, keeps headings/items/paragraphs', () => {
    const md = [
      '---',
      'period: custom',
      'since: 2026-08-01',
      '---',
      '',
      '# 기간 정리 2026-08-01 – 2026-09-30',
      '',
      '일지 29 · PR 102 · 커밋 546',
      '',
      '## cairn',
      '',
      '- 요약 성능 — 96초→28초',
      '* 수동 편집 불릿',
      '',
    ].join('\n');
    const { body, blocks } = parsePeriodDoc(md);
    expect(body.startsWith('# 기간 정리')).toBe(true);
    expect(blocks).toEqual([
      { kind: 'paragraph', text: '일지 29 · PR 102 · 커밋 546' },
      { kind: 'heading', text: 'cairn' },
      { kind: 'item', text: '요약 성능 — 96초→28초' },
      { kind: 'item', text: '수동 편집 불릿' },
    ]);
  });
});
