import { describe, expect, it } from 'vitest';
import {
  isScheduledTimeReached,
  lastCompletedMonthAnchor,
  lastCompletedWeekAnchor,
  localTodayIso,
  msUntilLocalTime,
} from './auto-publish-schedule';

// Date 는 로컬 컴포넌트로 생성 — 머신 TZ 와 무관하게 동일 결과

describe('isScheduledTimeReached', () => {
  it('예약 시각 전이면 false', () => {
    expect(isScheduledTimeReached(new Date(2026, 6, 4, 18, 59), '19:00')).toBe(false);
  });
  it('예약 시각 정각·이후면 true', () => {
    expect(isScheduledTimeReached(new Date(2026, 6, 4, 19, 0), '19:00')).toBe(true);
    expect(isScheduledTimeReached(new Date(2026, 6, 4, 23, 30), '19:00')).toBe(true);
  });
  it('시각 문자열이 깨지면 기본 19:00 으로 판정', () => {
    expect(isScheduledTimeReached(new Date(2026, 6, 4, 18, 0), 'bogus')).toBe(false);
    expect(isScheduledTimeReached(new Date(2026, 6, 4, 19, 30), 'bogus')).toBe(true);
  });
});

describe('msUntilLocalTime', () => {
  it('예약 시각 전이면 오늘 발화까지 남은 시간', () => {
    const now = new Date(2026, 6, 4, 18, 0, 0, 0);
    expect(msUntilLocalTime('19:00', now)).toBe(60 * 60_000);
  });
  it('예약 시각을 지났으면 내일로', () => {
    const now = new Date(2026, 6, 4, 19, 0, 0, 0);
    expect(msUntilLocalTime('19:00', now)).toBe(24 * 60 * 60_000);
  });
  it('자정 경계 넘어 계산', () => {
    const now = new Date(2026, 6, 4, 23, 30, 0, 0);
    expect(msUntilLocalTime('00:15', now)).toBe(45 * 60_000);
  });
});

describe('lastCompletedWeekAnchor', () => {
  it('한 주 내내(월~일) 같은 지난주 일요일', () => {
    const expected = '2026-06-28';
    expect(lastCompletedWeekAnchor(new Date(2026, 5, 29))).toBe(expected); // 월
    expect(lastCompletedWeekAnchor(new Date(2026, 6, 1))).toBe(expected); // 수
    expect(lastCompletedWeekAnchor(new Date(2026, 6, 5))).toBe(expected); // 일
  });
  it('다음 주 월요일부터 새 anchor', () => {
    expect(lastCompletedWeekAnchor(new Date(2026, 6, 6))).toBe('2026-07-05');
  });
  it('월 경계를 넘는 주', () => {
    expect(lastCompletedWeekAnchor(new Date(2026, 7, 1))).toBe('2026-07-26');
  });
});

describe('lastCompletedMonthAnchor', () => {
  it('한 달 내내 같은 지난달 말일', () => {
    expect(lastCompletedMonthAnchor(new Date(2026, 6, 1))).toBe('2026-06-30');
    expect(lastCompletedMonthAnchor(new Date(2026, 6, 31))).toBe('2026-06-30');
  });
  it('연 경계', () => {
    expect(lastCompletedMonthAnchor(new Date(2026, 0, 10))).toBe('2025-12-31');
  });
  it('2월 말일(윤년 아님)', () => {
    expect(lastCompletedMonthAnchor(new Date(2026, 2, 15))).toBe('2026-02-28');
  });
});

describe('localTodayIso', () => {
  it('zero-padding', () => {
    expect(localTodayIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
