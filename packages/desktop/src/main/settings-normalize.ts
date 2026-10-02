import type { Settings } from './settings';

type Guard<T> = (v: unknown) => v is T;

const isBool: Guard<boolean> = (v): v is boolean => typeof v === 'boolean';
const isString: Guard<string> = (v): v is string => typeof v === 'string';
const isFiniteNumber: Guard<number> = (v): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const isStringOrNull: Guard<string | null> = (v): v is string | null =>
  v === null || typeof v === 'string';
const oneOf =
  <T extends string>(values: readonly T[]): Guard<T> =>
  (v): v is T =>
    typeof v === 'string' && (values as readonly string[]).includes(v);
const isTime: Guard<string> = (v): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isBackfillDays: Guard<number> = (v): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 365;

const pick = <T>(v: unknown, ok: Guard<T>, fallback: T): T => (ok(v) ? v : fallback);
const objectOf = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

// 디스크·renderer 에서 온 설정의 필드별 타입 보정 — renderer 는 신뢰 불가라 truthy 문자열로 OS 로그인 항목·
// 임의 경로가 켜지지 않게, 잘못된 값은 fallback(기본값 또는 직전 값)으로, 모르는 키는 보존
export function normalizeSettings(raw: unknown, fb: Settings): Settings {
  const r = objectOf(raw);
  const ap = objectOf(r.autoPublish);
  const prompts = objectOf(r.prompts);
  const ex = objectOf(r.export);
  const graph = objectOf(r.graph);
  const backup = objectOf(r.backup);
  return {
    ...r,
    theme: pick(r.theme, oneOf(['dark', 'light', 'system'] as const), fb.theme),
    accent: pick(r.accent, isString, fb.accent),
    liquidGlass: pick(r.liquidGlass, isBool, fb.liquidGlass),
    language: pick(r.language, oneOf(['ko', 'en'] as const), fb.language),
    notifications: pick(r.notifications, isBool, fb.notifications),
    launchAtLogin: pick(r.launchAtLogin, isBool, fb.launchAtLogin),
    telemetry: pick(r.telemetry, isBool, fb.telemetry),
    installId: pick(r.installId, isString, fb.installId),
    autoPublish: {
      daily: pick(ap.daily, isBool, fb.autoPublish.daily),
      weekly: pick(ap.weekly, isBool, fb.autoPublish.weekly),
      monthly: pick(ap.monthly, isBool, fb.autoPublish.monthly),
      yearly: pick(ap.yearly, isBool, fb.autoPublish.yearly),
      time: pick(ap.time, isTime, fb.autoPublish.time),
      backfillDays: pick(ap.backfillDays, isBackfillDays, fb.autoPublish.backfillDays),
      confirmBeforeRun: pick(ap.confirmBeforeRun, isBool, fb.autoPublish.confirmBeforeRun),
    },
    prompts: {
      daily: pick(prompts.daily, isStringOrNull, fb.prompts.daily),
      weekly: pick(prompts.weekly, isStringOrNull, fb.prompts.weekly),
      monthly: pick(prompts.monthly, isStringOrNull, fb.prompts.monthly),
      yearly: pick(prompts.yearly, isStringOrNull, fb.prompts.yearly),
    },
    summaryModel: pick(
      r.summaryModel,
      oneOf(['default', 'sonnet', 'haiku', 'opus'] as const),
      fb.summaryModel,
    ),
    export: {
      folder: pick(ex.folder, isStringOrNull, fb.export.folder),
      autoSync: pick(ex.autoSync, isBool, fb.export.autoSync),
    },
    graph: {
      enabled: pick(graph.enabled, isBool, fb.graph.enabled),
      nodeScale: pick(graph.nodeScale, isFiniteNumber, fb.graph.nodeScale),
      spread: pick(graph.spread, isFiniteNumber, fb.graph.spread),
      gravity: pick(graph.gravity, isFiniteNumber, fb.graph.gravity),
      labels: pick(graph.labels, oneOf(['auto', 'always', 'hover'] as const), fb.graph.labels),
      showRollups: pick(graph.showRollups, isBool, fb.graph.showRollups),
    },
    backup: { enabled: pick(backup.enabled, isBool, fb.backup.enabled) },
  };
}
