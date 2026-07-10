import { describe, expect, it } from 'vitest';
import { keepIfEmpty, upsertByLabel } from './onboarding-merge';

describe('upsertByLabel — 발행 대상(첫 워크스페이스) 순서 보존', () => {
  const ws = (label: string, tag = '') => ({ label, tag });

  it('같은 라벨 재연결은 제자리 교체 — 배열 끝으로 밀지 않는다', () => {
    const prev = [ws('Personal', 'old'), ws('Work')];
    const result = upsertByLabel(prev, ws('Personal', 'new'), 'Personal');
    expect(result.map((w) => (w as { label: string }).label)).toEqual(['Personal', 'Work']);
    expect((result[0] as { tag: string }).tag).toBe('new');
  });

  it('신규 라벨은 끝에 추가', () => {
    const prev = [ws('Personal')];
    const result = upsertByLabel(prev, ws('Work'), 'Work');
    expect(result.map((w) => (w as { label: string }).label)).toEqual(['Personal', 'Work']);
  });

  it('빈 배열에 첫 추가', () => {
    expect(upsertByLabel([], ws('Personal'), 'Personal')).toHaveLength(1);
  });
});

describe('keepIfEmpty — 온보딩 재실행 시 빈 payload 는 기존 보존', () => {
  it('next 가 비면 prev 를 그대로 (무경고 삭제 방지)', () => {
    const prev = [{ label: 'gh', tokenEnv: 'GITHUB_TOKEN' }];
    expect(keepIfEmpty([], prev)).toBe(prev);
  });

  it('next 가 있으면 next 로 교체', () => {
    const prev = [{ label: 'old', tokenEnv: 'X' }];
    const next = [{ label: 'new', tokenEnv: 'Y' }];
    expect(keepIfEmpty(next, prev)).toBe(next);
  });
});
