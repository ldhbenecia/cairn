import { describe, expect, it } from 'vitest';
import { deriveSinkOutcomes } from './publish-sinks';

const base = {
  journalFile: '2026-07-25.md',
  journalWriteFailed: false,
  notionUrl: null as string | null,
  publishKind: null as 'created' | 'recreated' | 'skipped' | 'no-target' | null,
  noActivity: false,
  cancelled: false,
};

const derive = (
  result: Partial<typeof base>,
  opts: { skipNotion?: boolean; obsidianConfigured?: boolean } = {},
) =>
  deriveSinkOutcomes({
    result: { ...base, ...result },
    skipNotion: opts.skipNotion ?? false,
    obsidianConfigured: opts.obsidianConfigured ?? false,
  });

describe('deriveSinkOutcomes', () => {
  it('로컬+노션 성공 — 둘 다 ok', () => {
    expect(derive({ publishKind: 'created', notionUrl: 'https://notion.so/x' })).toEqual([
      { sink: 'journal', state: 'ok' },
      { sink: 'notion', state: 'ok' },
    ]);
  });

  it('로컬-온리(no-target) — 노션은 skipped', () => {
    expect(derive({ publishKind: 'no-target' })).toEqual([
      { sink: 'journal', state: 'ok' },
      { sink: 'notion', state: 'skipped' },
    ]);
  });

  it('--skip-notion — 노션 skipped (publishKind 무관)', () => {
    expect(derive({ publishKind: null }, { skipNotion: true })).toEqual([
      { sink: 'journal', state: 'ok' },
      { sink: 'notion', state: 'skipped' },
    ]);
  });

  it('노션 부분 실패 — 일지 ok, 노션 failed (토큰 만료 등)', () => {
    expect(derive({ publishKind: null, notionUrl: null })).toEqual([
      { sink: 'journal', state: 'ok' },
      { sink: 'notion', state: 'failed' },
    ]);
  });

  it('일지 기록 실패 — journal failed', () => {
    const out = derive({ journalWriteFailed: true });
    expect(out[0]).toEqual({ sink: 'journal', state: 'failed' });
  });

  it('Obsidian 설정 시 행 추가 — 일지 ok 면 ok, 일지 실패면 skipped', () => {
    expect(derive({ publishKind: 'created' }, { obsidianConfigured: true })).toContainEqual({
      sink: 'obsidian',
      state: 'ok',
    });
    expect(derive({ journalWriteFailed: true }, { obsidianConfigured: true })).toContainEqual({
      sink: 'obsidian',
      state: 'skipped',
    });
  });

  it('Obsidian 미설정이면 행 없음', () => {
    expect(derive({ publishKind: 'created' }).some((o) => o.sink === 'obsidian')).toBe(false);
  });

  it('취소·활동 없음·일지 미기록 — 빈 배열(행 미표시)', () => {
    expect(derive({ cancelled: true })).toEqual([]);
    expect(derive({ noActivity: true })).toEqual([]);
    expect(derive({ journalFile: null as unknown as string })).toEqual([]);
  });
});
