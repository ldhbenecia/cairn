import { app } from 'electron';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './atomic-write';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
// 'default' 는 Claude 로그인 기본 모델
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';

export type AutoPublish = {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  yearly: boolean;
  time: string;
  backfillDays: number;
  confirmBeforeRun: boolean;
};

export type ExportConfig = {
  folder: string | null;
  autoSync: boolean;
};

export type GraphLabels = 'auto' | 'always' | 'hover';

export type GraphConfig = {
  enabled: boolean;
  nodeScale: number;
  spread: number;
  gravity: number;
  labels: GraphLabels;
  showRollups: boolean;
};

export type QuickCaptureConfig = {
  enabled: boolean;
  shortcut: string;
};

export type BackupConfig = {
  enabled: boolean;
};

export type Settings = {
  theme: Theme;
  accent: string;
  liquidGlass: boolean;
  language: Language;
  notifications: boolean;
  launchAtLogin: boolean;
  telemetry: boolean;
  installId: string;
  autoPublish: AutoPublish;
  prompts: {
    daily: string | null;
    weekly: string | null;
    monthly: string | null;
    yearly: string | null;
  };
  summaryModel: SummaryModel;
  export: ExportConfig;
  graph: GraphConfig;
  quickCapture: QuickCaptureConfig;
  backup: BackupConfig;
};

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
  quickCapture: { enabled: true, shortcut: 'CommandOrControl+Shift+Space' },
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
      language: parsed.language ?? machineLanguage(),
      liquidGlass,
      autoPublish: {
        daily: ap.daily,
        weekly: ap.weekly,
        monthly: ap.monthly,
        yearly: ap.yearly,
        time: ap.time,
        backfillDays: ap.backfillDays,
        confirmBeforeRun: ap.confirmBeforeRun,
      },
      prompts: { ...DEFAULTS.prompts, ...(parsed.prompts ?? {}) },
      export: { ...DEFAULTS.export, ...(parsed.export ?? {}) },
      graph: { ...DEFAULTS.graph, ...(parsed.graph ?? {}) },
      quickCapture: { ...DEFAULTS.quickCapture, ...(parsed.quickCapture ?? {}) },
      backup: { ...DEFAULTS.backup, ...(parsed.backup ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, language: machineLanguage() };
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
    graph: { ...prev.graph, ...(patch.graph ?? {}) },
    quickCapture: { ...prev.quickCapture, ...(patch.quickCapture ?? {}) },
    backup: { ...prev.backup, ...(patch.backup ?? {}) },
  };
  writeFileAtomic(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
