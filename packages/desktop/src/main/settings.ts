import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './atomic-write';
import { mergeSettings } from '../shared/merge-settings';
import { normalizeSettings } from './settings-normalize';
import type { Language, AutoPublish, Settings } from '../shared/ipc-types';
export type {
  Theme,
  Language,
  SummaryModel,
  AutoPublish,
  ExportConfig,
  GraphLabels,
  GraphConfig,
  BackupConfig,
  Settings,
} from '../shared/ipc-types';

const DEFAULTS: Settings = {
  theme: 'system',
  accent: 'indigo',
  liquidGlass: false,
  language: 'en',
  notifications: true,
  launchAtLogin: false,
  telemetry: true,
  installId: '',
  autoPublish: {
    daily: false,
    weekly: false,
    monthly: false,
    yearly: false,
    time: '19:00',
    backfillDays: 7,
    confirmBeforeRun: false,
  },
  prompts: { daily: null, weekly: null, monthly: null, yearly: null },
  summaryModel: 'sonnet',
  export: { folder: null, autoSync: false },
  graph: { enabled: true, nodeScale: 1, spread: 1, gravity: 1, labels: 'auto', showRollups: true },
  backup: { enabled: false },
};

const SETTINGS_PATH = join(homedir(), '.cairn', 'settings.json');

function machineLanguage(): Language {
  try {
    return app.getLocale().startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function readSettings(): Settings {
  const fallback: Settings = { ...DEFAULTS, language: machineLanguage() };
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Record<string, unknown> & {
      autoPublish?: Partial<AutoPublish> & { enabled?: boolean };
    };
    const autoPublish: Record<string, unknown> = { ...(parsed.autoPublish ?? {}) };
    // 레거시: 단일 토글 enabled → daily 로 이관
    if (parsed.autoPublish?.enabled !== undefined && parsed.autoPublish.daily === undefined) {
      autoPublish.daily = parsed.autoPublish.enabled;
    }
    // 레거시: liquidGlass 가 enum('clear'/'tint') 이던 시기 → boolean 으로
    const lg = parsed.liquidGlass;
    const liquidGlass = lg === true || lg === 'clear' || lg === 'tint';
    return normalizeSettings({ ...parsed, liquidGlass, autoPublish }, fallback);
  } catch {
    return fallback;
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const prev = readSettings();
  const next = normalizeSettings(mergeSettings(prev, patch), prev);
  writeFileAtomic(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
