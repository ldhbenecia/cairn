import { parseArgs } from 'node:util';
import { todayLocalIsoDate } from '../common/date-window.js';
import type { RunMode, RunOptions, RunSource, WorklogLang } from './run-options.js';

const VALID_MODES: readonly RunMode[] = ['daily', 'weekly', 'monthly'];
const VALID_SOURCES: readonly RunSource[] = ['github', 'local-git'];
const VALID_LANGS: readonly WorklogLang[] = ['ko', 'en'];

export function parseCliArgs(argv: readonly string[]): RunOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      mode: { type: 'string', default: 'daily' },
      date: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'backfill-days': { type: 'string', default: '7' },
      'lookback-days': { type: 'string', default: '14' },
      source: { type: 'string', multiple: true, default: [] },
      lang: { type: 'string', default: 'ko' },
    },
    strict: true,
    allowPositionals: false,
  });

  const mode = assertMode(values.mode);
  const dateExplicit = typeof values.date === 'string' && values.date.length > 0;
  const date = dateExplicit ? values.date! : defaultDateForMode(mode);
  assertIsoDate(date);
  const backfillDays = parseBackfillDays(values['backfill-days']);
  const lookbackDays = parseLookbackDays(values['lookback-days']);
  const sources = parseSources(values.source);
  const lang = assertLang(values.lang);

  return {
    mode,
    date,
    dateExplicit,
    dryRun: values['dry-run'] ?? false,
    force: values.force ?? false,
    backfillDays,
    lookbackDays,
    sources,
    lang,
  };
}

function defaultDateForMode(mode: RunMode): string {
  if (mode === 'weekly') return localIsoDateOffset(-7);
  if (mode === 'monthly') return localIsoDateOffset(-5);
  return todayLocalIsoDate();
}

// 로컬 타임존 기준 (rules/timezone.md, ADR 0016)
function localIsoDateOffset(dayOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function assertLang(value: unknown): WorklogLang {
  if (typeof value !== 'string' || !VALID_LANGS.includes(value as WorklogLang)) {
    throw new Error(`--lang must be one of ${VALID_LANGS.join(', ')} (got: ${String(value)})`);
  }
  return value as WorklogLang;
}

function assertMode(value: unknown): RunMode {
  if (typeof value !== 'string' || !VALID_MODES.includes(value as RunMode)) {
    throw new Error(`--mode must be one of ${VALID_MODES.join(', ')} (got: ${String(value)})`);
  }
  return value as RunMode;
}

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`--date must be YYYY-MM-DD (got: ${value})`);
  }
}

function parseSources(raw: string[]): RunOptions['sources'] {
  if (raw.length === 0) return 'all';
  const invalid = raw.filter((s) => !VALID_SOURCES.includes(s as RunSource));
  if (invalid.length > 0) {
    throw new Error(
      `--source must be one of ${VALID_SOURCES.join(', ')} (got: ${invalid.join(', ')})`,
    );
  }
  return raw as RunSource[];
}

function parseBackfillDays(raw: string | undefined): number {
  if (raw === undefined) return 7;
  const n = Number(raw);
  // CLI 가드 상한(366). 데스크톱 무료 UI 는 7일 고정 — 긴 범위는 추후 유료 UI 게이팅(plan 2026-06-19).
  if (!Number.isInteger(n) || n < 0 || n > 366) {
    throw new Error(`--backfill-days must be an integer 0-366 (got: ${raw})`);
  }
  return n;
}

function parseLookbackDays(raw: string | undefined): number {
  if (raw === undefined) return 14;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 60) {
    throw new Error(`--lookback-days must be an integer 0-60 (got: ${raw})`);
  }
  return n;
}
