import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';

export type AutoPublish = {
  enabled: boolean; // opt-in = 동의. 기본 false
  time: string; // "HH:mm" 매일 발화 시각
  backfillDays: number; // 실행 시 백필 일수
  confirmBeforeRun: boolean; // true 면 자동 실행 대신 알림으로 확인
};

export type Settings = {
  theme: Theme;
  accent: string;
  language: Language;
  notifications: boolean;
  autoPublish: AutoPublish;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
};

const DEFAULTS: Settings = {
  theme: 'system',
  accent: 'indigo',
  language: 'en',
  notifications: true,
  autoPublish: { enabled: false, time: '19:00', backfillDays: 7, confirmBeforeRun: false },
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
      autoPublish: { ...DEFAULTS.autoPublish, ...(parsed.autoPublish ?? {}) },
      prompts: { ...DEFAULTS.prompts, ...(parsed.prompts ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const prev = readSettings();
  const next: Settings = {
    ...prev,
    ...patch,
    autoPublish: { ...prev.autoPublish, ...(patch.autoPublish ?? {}) },
    prompts: { ...prev.prompts, ...(patch.prompts ?? {}) },
  };
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
