import { describe, expect, it } from 'vitest';
import { renderDailyJournalMarkdown } from './journal-markdown.js';
import { blocksToWorklogSummary, parseJournalFile } from './journal-parse.js';
import { parseSummaryFromBlocks } from '../rollup/rollup-collector.service.js';

const SUMMARY = {
  paragraph: '수집기를 정리했다.',
  shareBullets: [],
  doneBullets: ['[work] 수집기 refactor', 'PR #12 머지'],
  reviewedBullets: ['PR #11'],
  inProgressBullets: [],
  notesBullets: ['내일 롤업 확인'],
};

describe('parseJournalFile', () => {
  const md = renderDailyJournalMarkdown({
    date: '2026-07-05',
    lang: 'ko',
    summary: SUMMARY,
    prCount: 2,
    commitCount: 7,
    hours: [],
  });

  it('frontmatter 키를 파싱한다', () => {
    const { fm } = parseJournalFile(md);
    expect(fm.get('date')).toBe('2026-07-05');
    expect(fm.get('period')).toBe('daily');
    expect(fm.get('pr')).toBe('2');
  });

  it('렌더 → 파스 왕복으로 요약 섹션이 복원된다', () => {
    const { blocks } = parseJournalFile(md);
    const parsed = parseSummaryFromBlocks(blocks);
    expect(parsed).not.toBeNull();
    expect(parsed!.paragraph).toBe('수집기를 정리했다.');
    expect(parsed!.doneBullets).toEqual(['[work] 수집기 refactor', 'PR #12 머지']);
    expect(parsed!.reviewedBullets).toEqual(['PR #11']);
    expect(parsed!.notesBullets).toEqual(['내일 롤업 확인']);
  });

  it('CRLF 파일도 동일하게 파싱한다', () => {
    const { fm, blocks } = parseJournalFile(md.replace(/\n/g, '\r\n'));
    expect(fm.get('date')).toBe('2026-07-05');
    expect(parseSummaryFromBlocks(blocks)?.doneBullets.length).toBe(2);
  });
});

describe('blocksToWorklogSummary (재발행용 역방향 복원)', () => {
  it('렌더 → 파스 → 복원 왕복으로 WorklogSummary 전 섹션(Share 포함)이 보존된다', () => {
    const original = {
      paragraph: '수집기를 정리했다.',
      shareBullets: ['팀 공유: 수집기 개선'],
      doneBullets: ['[work] 수집기 refactor'],
      reviewedBullets: ['PR #11'],
      inProgressBullets: ['롤업 개선'],
      notesBullets: ['내일 확인'],
    };
    const md = renderDailyJournalMarkdown({
      date: '2026-07-07',
      lang: 'ko',
      summary: original,
      prCount: 1,
      commitCount: 3,
      hours: [],
    });
    const { blocks } = parseJournalFile(md);
    expect(blocksToWorklogSummary(blocks)).toEqual(original);
  });

  it('내용 없는 블록이면 null (빈 페이지 재발행 방지)', () => {
    expect(blocksToWorklogSummary([])).toBeNull();
    expect(blocksToWorklogSummary([{ type: 'heading_2', text: 'Summary' }])).toBeNull();
  });
});
