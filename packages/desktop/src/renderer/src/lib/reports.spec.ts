import { describe, expect, it } from 'vitest';
import { addDays, buildLanes, dayIndex, daySpan, parseDoneBullet, timelineAxis } from './reports';

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

  it('peaks — 2건 이상인 날만 건수순 상위 2곳', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
      { date: '2026-07-04', repo: 'a', text: 'x' },
      { date: '2026-07-04', repo: 'a', text: 'x' },
      { date: '2026-07-06', repo: 'a', text: 'x' },
      { date: '2026-07-06', repo: 'a', text: 'x' },
    ]);
    expect(lanes[0]!.peaks).toEqual([
      { date: '2026-07-02', count: 3 },
      { date: '2026-07-04', count: 2 },
    ]);
  });

  it('peaks — 전부 1건이면 비어 있음', () => {
    const lanes = buildLanes([
      { date: '2026-07-01', repo: 'a', text: 'x' },
      { date: '2026-07-02', repo: 'a', text: 'x' },
    ]);
    expect(lanes[0]!.peaks).toEqual([]);
  });
});

describe('timelineAxis', () => {
  it('월 라벨 — 기간 시작 + 매월 1일', () => {
    const { months } = timelineAxis('2026-05-15', '2026-07-14');
    expect(months.map((t) => t.date)).toEqual(['2026-05-15', '2026-06-01', '2026-07-01']);
    expect(months[0]!.pos).toBe(0);
  });

  it('첫 달 조각이 좁으면 시작 라벨 드랍', () => {
    const { months } = timelineAxis('2026-06-30', '2026-08-31');
    expect(months.map((t) => t.date)).toEqual(['2026-07-01', '2026-08-01']);
  });

  it('일 눈금 — 2주 초과는 월요일 주 단위', () => {
    // 2026-07-06 은 월요일
    const { days } = timelineAxis('2026-07-01', '2026-07-31');
    expect(days.map((t) => t.date)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
    ]);
    expect(days[0]!.pos).toBeCloseTo(5 / 31);
  });

  it('일 눈금 — 2주 이하는 매일', () => {
    const { days } = timelineAxis('2026-07-01', '2026-07-07');
    expect(days.map((t) => t.date)).toHaveLength(7);
    expect(days[0]!.date).toBe('2026-07-01');
  });

  it('일 눈금 — 연 단위 기간은 성기게 (26개 이하)', () => {
    const { days } = timelineAxis('2025-07-19', '2026-07-18');
    expect(days.length).toBeLessThanOrEqual(26);
    expect(days.length).toBeGreaterThan(20);
  });
});
