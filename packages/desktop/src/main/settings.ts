import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';

export type Settings = {
  theme: Theme;
  language: Language;
  notifications: boolean;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
};

const DEFAULTS: Settings = {
  theme: 'dark',
  language: 'ko',
  notifications: true,
  prompts: { daily: null, weekly: null, monthly: null },
};

// 사용자 환경설정은 머신 로컬 ~/.cairn/settings.json (worklog.config.json = 엔진 데이터 config 와 분리)
const SETTINGS_PATH = join(homedir(), '.cairn', 'settings.json');

export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<Settings>;
    return {
      ...DEFAULTS,
      ...parsed,
      prompts: { ...DEFAULTS.prompts, ...(parsed.prompts ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next: Settings = {
    ...readSettings(),
    ...patch,
    prompts: { ...readSettings().prompts, ...(patch.prompts ?? {}) },
  };
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
