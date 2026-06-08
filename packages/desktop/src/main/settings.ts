import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';

export type AutoPublish = {
  daily: boolean; // 매일 일지 (opt-in)
  weekly: boolean; // 월요일에 지난주 정리 (opt-in)
  monthly: boolean; // 매월 1일에 지난달 정리 (opt-in)
  time: string; // "HH:mm" 발화 시각 (공유)
  backfillDays: number; // daily 백필 일수
  confirmBeforeRun: boolean; // true 면 자동 실행 대신 알림으로 확인
};

export type Settings = {
  theme: Theme;
  accent: string;
  language: Language;
  notifications: boolean;
  telemetry: boolean;
  installId: string;
  autoPublish: AutoPublish;
  prompts: { daily: string | null; weekly: string | null; monthly: string | null };
};

const DEFAULTS: Settings = {
  theme: 'system',
  accent: 'indigo',
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
};

// 사용자 환경설정은 머신 로컬 ~/.cairn/settings.json (worklog.config.json = 엔진 데이터 config 와 분리)
const SETTINGS_PATH = join(homedir(), '.cairn', 'settings.json');

export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as Partial<Settings> & {
      autoPublish?: Partial<AutoPublish> & { enabled?: boolean };
    };
    const ap = { ...DEFAULTS.autoPublish, ...(parsed.autoPublish ?? {}) };
    // 레거시: 단일 토글 enabled → daily 로 이관
    if (parsed.autoPublish?.enabled !== undefined && parsed.autoPublish.daily === undefined) {
      ap.daily = parsed.autoPublish.enabled;
    }
    return {
      ...DEFAULTS,
      ...parsed,
      autoPublish: {
        daily: ap.daily,
        weekly: ap.weekly,
        monthly: ap.monthly,
        time: ap.time,
        backfillDays: ap.backfillDays,
        confirmBeforeRun: ap.confirmBeforeRun,
      },
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
