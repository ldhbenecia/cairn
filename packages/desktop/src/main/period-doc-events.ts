import type { PeriodDocRange } from '../shared/ipc-types';
export type { PeriodDocRange } from '../shared/ipc-types'; // 저장 위치·파일명 포맷은 core/src/period-doc 과 같이 바꿔야 함

export const PERIOD_DOC_DIR = 'periods';
export const PERIOD_DOC_MAX_DAYS = 366;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FILE_RE = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.md$/;

const dayNumber = (iso: string): number => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

// 이 값으로 파일 경로를 만들어 renderer 인자를 형식·범위까지 엄격히 검증
export function isValidRange(v: unknown): v is PeriodDocRange {
  if (!v || typeof v !== 'object') return false;
  const { since, until } = v as Record<string, unknown>;
  if (typeof since !== 'string' || typeof until !== 'string') return false;
  if (!ISO.test(since) || !ISO.test(until)) return false;
  const span = dayNumber(until) - dayNumber(since);
  return Number.isInteger(span) && span >= 0 && span < PERIOD_DOC_MAX_DAYS;
}

export function periodDocFileName({ since, until }: PeriodDocRange): string {
  return `${since}_${until}.md`;
}

export type PeriodDocEvent = { type: 'written'; fileName: string } | { type: 'empty' };

export function parsePeriodDocEvent(raw: unknown): PeriodDocEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.cairn !== 1) return null;
  if (m.type === 'period-doc-empty') return { type: 'empty' };
  if (m.type === 'period-doc-written' && typeof m.fileName === 'string' && FILE_RE.test(m.fileName))
    return { type: 'written', fileName: m.fileName };
  return null;
}
