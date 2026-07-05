import { describe, expect, it } from 'vitest';
import {
  dailyFileName,
  renderDailyJournalMarkdown,
  renderRollupJournalMarkdown,
  rollupFileName,
} from './journal-markdown.js';

const SUMMARY = {
  paragraph: '오늘은 수집기를 정리했다.',
  shareBullets: [],
  doneBullets: ['[work] 수집기 refactor', 'PR #12 머지'],
  reviewedBullets: ['PR #11'],
  inProgressBullets: [],
  notesBullets: ['내일 롤업 확인'],
};

describe('journal file names', () => {
  it('daily = date.md', () => {
    expect(dailyFileName('2026-07-05')).toBe('2026-07-05.md');
  });

  it('weekly = ISO week label, monthly = month label', () => {
    expect(rollupFileName('weekly', '2026-06-29')).toBe('2026-W27.md');
    expect(rollupFileName('monthly', '2026-07-01')).toBe('2026-07.md');
  });
});

describe('renderDailyJournalMarkdown', () => {
  const md = renderDailyJournalMarkdown({
    date: '2026-07-05',
    lang: 'ko',
    summary: SUMMARY,
    prCount: 2,
    commitCount: 7,
    hours: new Array<number>(24).fill(0),
  });

  it('frontmatter 에 date·period·수치를 기록한다', () => {
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('date: 2026-07-05');
    expect(md).toContain('period: daily');
    expect(md).toContain('pr: 2');
    expect(md).toContain('commit: 7');
    expect(md).toContain('hours: [0,0,0');
  });

  it('빈 섹션은 생략하고 채워진 섹션만 렌더한다', () => {
    expect(md).toContain('## Summary');
    expect(md).toContain('## Done');
    expect(md).toContain('- PR #12 머지');
    expect(md).toContain('## Notes');
    expect(md).not.toContain('## Share');
    expect(md).not.toContain('## In Progress');
  });

  it('model 은 usage 에 있을 때만 frontmatter 에 추가된다', () => {
    expect(md).not.toContain('model:');
    const withModel = renderDailyJournalMarkdown({
      date: '2026-07-05',
      lang: 'ko',
      summary: {
        ...SUMMARY,
        usage: { inputTokens: 1, outputTokens: 1, costUsd: 0, model: 'claude-sonnet-5' },
      },
      prCount: 2,
      commitCount: 7,
      hours: [],
    });
    expect(withModel).toContain('model: claude-sonnet-5');
  });

  it('notion 참조는 있을 때만 frontmatter 에 추가된다', () => {
    expect(md).not.toContain('notion:');
    const withRef = renderDailyJournalMarkdown({
      date: '2026-07-05',
      lang: 'ko',
      summary: SUMMARY,
      prCount: 2,
      commitCount: 7,
      hours: [],
      notionPageId: 'abc-123',
    });
    expect(withRef).toContain('notion: abc-123');
  });
});

describe('renderRollupJournalMarkdown', () => {
  const md = renderRollupJournalMarkdown({
    period: 'weekly',
    rangeStart: '2026-06-29',
    rangeEnd: '2026-07-05',
    lang: 'ko',
    summary: {
      paragraph: '이번 주는 릴리스를 마무리했다.',
      themes: [{ title: '릴리스', items: ['0.26.1 배포'] }],
      highlights: ['정리 스윕'],
    },
    dailyDates: ['2026-06-30', '2026-07-01'],
    prCount: 5,
    commitCount: 20,
  });

  it('range 와 period 를 frontmatter 에 기록한다', () => {
    expect(md).toContain('period: weekly');
    expect(md).toContain('rangeStart: 2026-06-29');
    expect(md).toContain('rangeEnd: 2026-07-05');
  });

  it('일간 일지를 위키링크로 연결한다', () => {
    expect(md).toContain('## Dailies');
    expect(md).toContain('- [[2026-06-30]]');
    expect(md).toContain('- [[2026-07-01]]');
  });

  it('테마를 섹션으로 렌더한다', () => {
    expect(md).toContain('## 릴리스');
    expect(md).toContain('- 0.26.1 배포');
    expect(md).toContain('## Highlights');
  });
});
