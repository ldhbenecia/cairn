import { describe, expect, it } from 'vitest';
import type { RecentPage, SimpleBlock } from '../cairn-api';
import { buildStandupText, pickStandupSource } from './standup';

const LABELS = { yesterday: '어제 한 일', today: '오늘 예정', blockers: '블로커', none: '없음' };

const daily = (date: string): RecentPage => ({
  pageId: `journal:${date}.md`,
  url: '',
  title: date,
  date,
  status: null,
  category: 'daily',
  pr: null,
  commit: null,
  hours: null,
  workspaceLabel: 'local',
});

const h2 = (text: string): SimpleBlock => ({
  id: `h-${text}`,
  type: 'heading_2',
  rich: [{ text }],
});
const li = (text: string): SimpleBlock => ({
  id: `b-${text}`,
  type: 'bulleted_list_item',
  rich: [{ text }],
});

describe('pickStandupSource', () => {
  it('오늘 이전의 최신 daily 를 고른다', () => {
    const pages = [daily('2026-07-12'), daily('2026-07-11'), daily('2026-07-09')];
    expect(pickStandupSource(pages, '2026-07-12')?.date).toBe('2026-07-11');
  });

  it('과거 일지가 없으면 오늘 일지로 폴백, 그것도 없으면 null', () => {
    expect(pickStandupSource([daily('2026-07-12')], '2026-07-12')?.date).toBe('2026-07-12');
    expect(pickStandupSource([], '2026-07-12')).toBeNull();
  });

  it('rollup·미래 날짜는 무시한다', () => {
    const weekly: RecentPage = { ...daily('2026-07-11'), category: 'weekly' };
    expect(pickStandupSource([weekly, daily('2026-07-13')], '2026-07-12')).toBeNull();
  });
});

describe('buildStandupText', () => {
  it('Share 가 있으면 어제 한 일 소스, In Progress 는 오늘 예정', () => {
    const blocks = [
      h2('Share'),
      li('발행 안정화 3건 마무리'),
      h2('Done'),
      li('[cairn] 상세 항목'),
      h2('In Progress'),
      li('그래프 뷰 물리 튜닝'),
    ];
    const text = buildStandupText(blocks, '2026-07-11', LABELS);
    expect(text).toBe(
      [
        '어제 한 일 (2026-07-11)',
        '- 발행 안정화 3건 마무리',
        '',
        '오늘 예정',
        '- 그래프 뷰 물리 튜닝',
        '',
        '블로커',
        '- 없음',
      ].join('\n'),
    );
  });

  it('Share 가 없으면 Done 으로 폴백, 빈 섹션은 없음 placeholder', () => {
    const blocks = [h2('Done'), li('[cairn] 릴리스 배포')];
    const text = buildStandupText(blocks, '2026-07-11', LABELS);
    expect(text).toContain('- [cairn] 릴리스 배포');
    expect(text).toContain('오늘 예정\n- 없음');
  });
});
