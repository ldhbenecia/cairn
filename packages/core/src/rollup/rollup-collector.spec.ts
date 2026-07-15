import { describe, expect, it } from 'vitest';
import type { ExtractedBlock } from '../notion/notion-api.types.js';
import {
  dedupeByDate,
  parseRollupTextFromBlocks,
  parseSummaryFromBlocks,
} from './rollup-collector.service.js';

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
      paragraph: '요약',
      doneBullets: ['[app] 직접 구현한 작업'],
      reviewedBullets: ['[api] 팀원 PR 리뷰와 승인'],
      inProgressBullets: ['[app] 진행 중인 작업'],
      notesBullets: ['메모'],
    });
  });
});

describe('dedupeByDate', () => {
  it('같은 날짜 중복은 첫 등장만 유지 (재발행 경합 이중 집계 방지)', () => {
    const pages = [
      { date: '2026-07-01', pageId: 'a' },
      { date: '2026-07-01', pageId: 'b' },
      { date: '2026-07-02', pageId: 'c' },
    ];
    expect(dedupeByDate(pages).map((p) => p.pageId)).toEqual(['a', 'c']);
  });

  it('중복 없으면 그대로', () => {
    const pages = [{ date: '2026-07-01' }, { date: '2026-07-02' }];
    expect(dedupeByDate(pages)).toHaveLength(2);
  });
});

describe('parseRollupTextFromBlocks (연간 합성 입력)', () => {
  it('Summary 문단 + Highlights·테마 불릿을 평탄화, Metrics·Dailies 제외', () => {
    const parsed = parseRollupTextFromBlocks([
      { type: 'heading_2', text: 'Summary' },
      { type: 'paragraph', text: '이 달의 요약.' },
      { type: 'heading_2', text: 'Highlights' },
      { type: 'bulleted_list_item', text: '[cairn] 그래프 뷰 출시' },
      { type: 'heading_2', text: '발행 파이프라인' },
      { type: 'bulleted_list_item', text: 'IPC 이벤트 이관' },
      { type: 'heading_2', text: 'Metrics' },
      { type: 'paragraph', text: 'gh:10 / git:20 / dailies:15' },
      { type: 'heading_2', text: 'Dailies' },
      { type: 'bulleted_list_item', text: '[[2026-06-01]]' },
    ]);
    expect(parsed).toEqual({
      paragraph: '이 달의 요약.',
      bullets: ['[cairn] 그래프 뷰 출시', 'IPC 이벤트 이관'],
    });
  });

  it('내용 없으면 null', () => {
    expect(parseRollupTextFromBlocks([{ type: 'heading_2', text: 'Metrics' }])).toBeNull();
  });
});
