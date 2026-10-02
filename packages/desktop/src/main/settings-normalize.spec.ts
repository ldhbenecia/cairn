import { describe, expect, it } from 'vitest';
import type { Settings } from './settings';
import { normalizeSettings } from './settings-normalize';

const fb: Settings = {
  theme: 'system',
  accent: 'indigo',
  liquidGlass: false,
  language: 'ko',
  notifications: true,
  launchAtLogin: false,
  telemetry: true,
  installId: 'id',
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

describe('normalizeSettings', () => {
  it('keeps valid values and unknown keys as-is', () => {
    const valid = {
      ...fb,
      theme: 'dark',
      summaryModel: 'haiku',
      export: { folder: '/x', autoSync: true },
      quickCapture: { enabled: true },
    };
    expect(normalizeSettings(valid, fb)).toEqual(valid);
  });

  it('falls back field by field for wrong types from the renderer', () => {
    const out = normalizeSettings(
      {
        ...fb,
        launchAtLogin: 'yes',
        backup: { enabled: 'true' },
        export: { folder: 42, autoSync: true },
        autoPublish: { ...fb.autoPublish, time: '25:00', backfillDays: 1.5, daily: true },
        summaryModel: 'gpt',
      },
      fb,
    );
    expect(out.launchAtLogin).toBe(false);
    expect(out.backup.enabled).toBe(false);
    expect(out.export).toEqual({ folder: null, autoSync: true });
    expect(out.autoPublish).toMatchObject({ time: '19:00', backfillDays: 7, daily: true });
    expect(out.summaryModel).toBe('sonnet');
  });

  it('treats a non-object as empty', () => {
    expect(normalizeSettings(null, fb)).toEqual(fb);
  });
});
