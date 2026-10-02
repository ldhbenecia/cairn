import { addDays, dayIndex, todayLocal } from './reports';

export type PeriodPreset = '1m' | '3m' | '6m' | 'ytd' | '1y';
export type PeriodRange = { since: string; until: string };

export const PERIOD_MAX_DAYS = 366;

const PRESET_DAYS: Record<Exclude<PeriodPreset, 'ytd'>, number> = {
  '1m': 30,
  '3m': 91,
  '6m': 182,
  '1y': 365,
};

// 오늘 포함 N일, 로컬 날짜 기준
export function presetRange(preset: PeriodPreset, today = todayLocal()): PeriodRange {
  if (preset === 'ytd') return { since: `${today.slice(0, 4)}-01-01`, until: today };
  return { since: addDays(today, -(PRESET_DAYS[preset] - 1)), until: today };
}

export type RangeProblem = 'reversed' | 'too-long' | null;

export function rangeProblem({ since, until }: PeriodRange): RangeProblem {
  if (since > until) return 'reversed';
  return dayIndex(since, until) >= PERIOD_MAX_DAYS ? 'too-long' : null;
}

export type DocBlock = { kind: 'heading' | 'paragraph' | 'item'; text: string };

// core 가 렌더한 형식(## 헤딩 · - 불릿 · 문단)만 해석 — 편집으로 생긴 모르는 줄은 문단 처리
export function parsePeriodDoc(md: string): { body: string; blocks: DocBlock[] } {
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
  const blocks: DocBlock[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('# ')) continue;
    if (line.startsWith('## ')) blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    else if (/^[-*] /.test(line)) blocks.push({ kind: 'item', text: line.slice(2).trim() });
    else blocks.push({ kind: 'paragraph', text: line });
  }
  return { body, blocks };
}
