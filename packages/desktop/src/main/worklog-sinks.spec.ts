import { describe, expect, it } from 'vitest';
import {
  buildExportIndex,
  exportIndexKey,
  isoWeekLabel,
  journalFileNameFor,
} from './worklog-sinks';

describe('isoWeekLabel', () => {
  it('ISO 주차 라벨 — core period-range 와 동일 규칙', () => {
    expect(isoWeekLabel('2026-07-05')).toBe('2026-W27');
    expect(isoWeekLabel('2026-06-29')).toBe('2026-W27');
    // 연 경계: 2026-01-01(목) 은 2026-W01
    expect(isoWeekLabel('2026-01-01')).toBe('2026-W01');
    // 2024-12-30(월) 은 2025-W01
    expect(isoWeekLabel('2024-12-30')).toBe('2025-W01');
  });

  it('날짜 형식이 아니면 null', () => {
    expect(isoWeekLabel('not-a-date')).toBeNull();
  });
});

describe('journalFileNameFor', () => {
  it('daily 는 날짜 그대로', () => {
    expect(journalFileNameFor('daily', '2026-07-05')).toBe('2026-07-05.md');
  });

  it('weekly 는 ISO 주차, monthly 는 연-월', () => {
    expect(journalFileNameFor('weekly', '2026-07-05')).toBe('2026-W27.md');
    expect(journalFileNameFor('monthly', '2026-07-31')).toBe('2026-07.md');
  });

  it('시각이 붙은 날짜도 앞 10자리로 처리', () => {
    expect(journalFileNameFor('daily', '2026-07-05T09:00:00+09:00')).toBe('2026-07-05.md');
  });
});

describe('buildExportIndex / exportIndexKey', () => {
  it('export 파일명(발행 실행일 기준)을 기간 라벨로 정규화해 대조', () => {
    const index = buildExportIndex([
      '2026-07-04.md',
      '2026-07-01-weekly.md',
      '2026-07-15-monthly.md',
      'random-note.md',
    ]);
    expect(index.has(exportIndexKey('daily', '2026-07-04') as string)).toBe(true);
    expect(index.has(exportIndexKey('daily', '2026-07-05') as string)).toBe(false);
    // 주간: 같은 ISO 주 안의 다른 날짜여도 매칭 (2026-07-01 수 → W27, 범위 끝 07-05 일)
    expect(index.has(exportIndexKey('weekly', '2026-07-05') as string)).toBe(true);
    expect(index.has(exportIndexKey('weekly', '2026-07-12') as string)).toBe(false);
    // 월간: 같은 달이면 매칭
    expect(index.has(exportIndexKey('monthly', '2026-07-31') as string)).toBe(true);
    expect(index.has(exportIndexKey('monthly', '2026-06-30') as string)).toBe(false);
  });
});
