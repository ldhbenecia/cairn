import { parseArgs } from 'node:util';
import type { RunMode, RunOptions, RunSource } from './run-options.js';

const VALID_MODES: readonly RunMode[] = ['daily', 'weekly', 'monthly'];
const VALID_SOURCES: readonly RunSource[] = ['github', 'local-git', 'notion'];

export function parseCliArgs(argv: readonly string[]): RunOptions {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      mode: { type: 'string', default: 'daily' },
      date: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      source: { type: 'string', multiple: true, default: [] },
    },
    strict: true,
    allowPositionals: false,
  });

  const mode = assertMode(values.mode);
  const date = values.date ?? todayKstIsoDate();
  assertIsoDate(date);
  const sources = parseSources(values.source);

  return {
    mode,
    date,
    dryRun: values['dry-run'] ?? false,
    force: values.force ?? false,
    sources,
  };
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

function todayKstIsoDate(): string {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + kstOffsetMs);
  return kstNow.toISOString().slice(0, 10);
}
