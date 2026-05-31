import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Settings, Theme } from './cairn-api';
import { translate, type I18nKey } from './i18n';

export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: (key: I18nKey) => string;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(window.cairn.initialSettings);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (): void => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      prompts: { ...prev.prompts, ...(patch.prompts ?? {}) },
    }));
    void window.cairn.setSettings(patch);
  }, []);

  const t = useCallback((key: I18nKey) => translate(settings.language, key), [settings.language]);

  return (
    <SettingsContext.Provider value={{ settings, update, t }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
