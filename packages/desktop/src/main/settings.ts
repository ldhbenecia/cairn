import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
// 'default' 는 Claude 로그인 기본 모델
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';

export type AutoPublish = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  time: string; // "HH:mm" 발화 시각
  backfillDays: number;
  confirmBeforeRun: boolean;
};

export type ExportConfig = {
  folder: string | null;
  autoSync: boolean;
};

export type Settings = {
  theme: Theme;
  accent: string;
  liquidGlass: boolean;
  language: Language;
  notifications: boolean;
  telemetry: boolean;
  installId: string;
  autoPublish: AutoPublish;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
  summaryModel: SummaryModel;
  export: ExportConfig;
};

const DEFAULTS: Settings = {
  theme: 'system',
  accent: 'indigo',
  liquidGlass: false,
  language: 'en',
  notifications: true,
  telemetry: true,
  installId: '',
  autoPublish: {
    daily: false,
    weekly: false,
    monthly: false,
    time: '19:00',
    backfillDays: 7,
    confirmBeforeRun: false,
  },
  prompts: { daily: null, weekly: null, monthly: null },
  summaryModel: 'sonnet',
  export: { folder: null, autoSync: false },
};

const SETTINGS_PATH = join(homedir(), '.cairn', 'settings.json');

export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<Settings> & {
      autoPublish?: Partial<AutoPublish> & { enabled?: boolean };
      liquidGlass?: boolean | string;
    };
    const ap = { ...DEFAULTS.autoPublish, ...(parsed.autoPublish ?? {}) };
    // 레거시: 단일 토글 enabled → daily 로 이관
    if (parsed.autoPublish?.enabled !== undefined && parsed.autoPublish.daily === undefined) {
      ap.daily = parsed.autoPublish.enabled;
    }
    // 레거시: liquidGlass 가 enum('clear'/'tint') 이던 시기 → boolean 으로
    const lg: unknown = parsed.liquidGlass;
    const liquidGlass = lg === true || lg === 'clear' || lg === 'tint';
    return {
      ...DEFAULTS,
      ...parsed,
      liquidGlass,
      autoPublish: {
        daily: ap.daily,
        weekly: ap.weekly,
        monthly: ap.monthly,
        time: ap.time,
        backfillDays: ap.backfillDays,
        confirmBeforeRun: ap.confirmBeforeRun,
      },
      prompts: { ...DEFAULTS.prompts, ...(parsed.prompts ?? {}) },
      export: { ...DEFAULTS.export, ...(parsed.export ?? {}) },
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
    export: { ...prev.export, ...(patch.export ?? {}) },
  };
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
