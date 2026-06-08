import { describe, expect, it } from 'vitest';
import type { ExtractedBlock } from '../notion/notion-api.types.js';
import { parseSummaryFromBlocks } from './rollup-collector.service.js';

describe('parseSummaryFromBlocks', () => {
  it('keeps reviewed bullets separate from authored work', () => {
    const blocks: ExtractedBlock[] = [
      { type: 'heading_2', text: 'Summary' },
      { type: 'paragraph', text: '요약' },
      { type: 'heading_2', text: 'Done' },
      { type: 'bulleted_list_item', text: '[app] 직접 구현한 작업' },
      { type: 'heading_2', text: 'Reviewed' },
      { type: 'bulleted_list_item', text: '[api] 팀원 PR 리뷰와 승인' },
      { type: 'heading_2', text: 'In Progress' },
      { type: 'bulleted_list_item', text: '[app] 진행 중인 작업' },
      { type: 'heading_2', text: 'Notes' },
      { type: 'bulleted_list_item', text: '메모' },
    ];

    expect(parseSummaryFromBlocks(blocks)).toEqual({
      paragraphKo: '요약',
      doneBullets: ['[app] 직접 구현한 작업'],
      reviewedBullets: ['[api] 팀원 PR 리뷰와 승인'],
      inProgressBullets: ['[app] 진행 중인 작업'],
      notesBullets: ['메모'],
    });
  });
});
