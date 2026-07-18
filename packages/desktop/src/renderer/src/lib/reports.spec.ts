import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildLanes,
  dayIndex,
  daySpan,
  laneSegments,
  parseDoneBullet,
  timelineTicks,
} from './reports';

describe('parseDoneBullet', () => {
  it('[repo] 프리픽스 — repo 와 본문 분리', () => {
    expect(parseDoneBullet('2026-07-01', '[cairn] 대시보드 정리')).toEqual({
      date: '2026-07-01',
      repo: 'cairn',
      text: '대시보드 정리',
    });
  });

  it('계정 라벨이 앞에 붙으면 두 번째 것이 repo', () => {
    expect(parseDoneBullet('2026-07-01', '[work] [api] 배포 스크립트')).toEqual({
      date: '2026-07-01',
      repo: 'api',
      text: '배포 스크립트',
    });
  });

  it('프리픽스 없으면 repo=null, 본문 그대로', () => {
    expect(parseDoneBullet('2026-07-01', '문서 리뷰')).toEqual({
      date: '2026-07-01',
      repo: null,
      text: '문서 리뷰',
    });
  });
});

describe('날짜 산술', () => {
  it('dayIndex / daySpan — 경계 포함', () => {
    expect(dayIndex('2026-07-01', '2026-07-01')).toBe(0);
    expect(dayIndex('2026-07-01', '2026-07-18')).toBe(17);
    expect(daySpan('2026-07-01', '2026-07-18')).toBe(18);
  });

  it('addDays — 월 경계를 넘는다', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02');
  });
});

describe('buildLanes', () => {
  it('항목 수 내림차순, 프리픽스 없는 묶음은 마지막', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'b', text: 'x' },
      { date: '2026-07-03', repo: 'b', text: 'x' },
      { date: '2026-07-01', repo: null, text: 'x' },
    ]);
    expect(lanes.map((l) => l.repo)).toEqual(['b', 'a', null]);
    expect(lanes[0]!.dates).toEqual(['2026-07-02', '2026-07-03']);
    expect(lanes[0]!.count).toBe(2);
  });
});

describe('laneSegments', () => {
  it('연속 활동일 병합, 공백에서 끊김', () => {
    expect(
      laneSegments(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-05', '2026-07-08']),
    ).toEqual([
      { from: '2026-07-01', to: '2026-07-03' },
      { from: '2026-07-05', to: '2026-07-05' },
      { from: '2026-07-08', to: '2026-07-08' },
    ]);
  });

  it('월 경계를 넘는 연속 구간', () => {
    expect(laneSegments(['2026-06-30', '2026-07-01'])).toEqual([
      { from: '2026-06-30', to: '2026-07-01' },
    ]);
  });

  it('빈 배열', () => {
    expect(laneSegments([])).toEqual([]);
  });
});

describe('timelineTicks', () => {
  it('45일 이하 — 월요일 주 눈금', () => {
    // 2026-07-06 은 월요일
    const { unit, ticks } = timelineTicks('2026-07-01', '2026-07-14');
    expect(unit).toBe('week');
    expect(ticks.map((t) => t.date)).toEqual(['2026-07-06', '2026-07-13']);
    expect(ticks[0]!.pos).toBeCloseTo(5 / 14);
  });

  it('45일 초과 — 매월 1일 눈금', () => {
    const { unit, ticks } = timelineTicks('2026-05-15', '2026-07-14');
    expect(unit).toBe('month');
    expect(ticks.map((t) => t.date)).toEqual(['2026-06-01', '2026-07-01']);
  });
});
