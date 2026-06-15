import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export type Theme = 'dark' | 'light' | 'system';
export type Language = 'ko' | 'en';
// 요약 모델 — 'default' 는 Claude 로그인 기본 모델, 나머지는 해당 모델로 override
export type SummaryModel = 'default' | 'sonnet' | 'haiku' | 'opus';

export type AutoPublish = {
  daily: boolean; // 매일 일지 (opt-in)
  weekly: boolean; // 월요일에 지난주 정리 (opt-in)
  monthly: boolean; // 매월 1일에 지난달 정리 (opt-in)
  time: string; // "HH:mm" 발화 시각 (공유)
  backfillDays: number; // daily 백필 일수
  confirmBeforeRun: boolean; // true 면 자동 실행 대신 알림으로 확인
};

// 로컬 Markdown 내보내기 — folder 지정 시 발행 성공마다 그 폴더에 일지를 .md 로 기록.
// folder 를 Obsidian vault 로 가리키면 곧 Obsidian 연동.
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

// 사용자 환경설정은 머신 로컬 ~/.cairn/settings.json (worklog.config.json = 엔진 데이터 config 와 분리)
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
