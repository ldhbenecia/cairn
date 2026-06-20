import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Settings, Theme } from './cairn-api';
import { translate, type I18nKey } from './i18n';

// per-element 트랜지션의 잔상을 피하려고 View Transitions API 로 화면 전체를 한 번에 크로스페이드.
type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

let themeMounted = false;
let accentMounted = false;
let glassMounted = false;

function runWithCrossfade(mutate: () => void, skip: boolean): void {
  const doc = document as ViewTransitionDoc;
  if (skip || typeof doc.startViewTransition !== 'function') {
    mutate();
    return;
  }
  doc.startViewTransition(mutate);
}

export function applyTheme(theme: Theme): void {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  // 첫 마운트는 즉시(초기 로드 깜빡임 방지), 이후 전환만 크로스페이드.
  runWithCrossfade(
    () => document.documentElement.setAttribute('data-theme', resolved),
    !themeMounted,
  );
  themeMounted = true;
}

export const ACCENTS = [
  { id: 'indigo', color: '#5b61e6', hover: '#757bf0', focus: '#474dcc' },
  { id: 'blue', color: '#3b82f6', hover: '#5b9bff', focus: '#2861c8' },
  { id: 'violet', color: '#8b5cf6', hover: '#a47cff', focus: '#6d3ed0' },
  { id: 'teal', color: '#14b8a6', hover: '#2dd4c2', focus: '#0c8f81' },
  { id: 'rose', color: '#f43f5e', hover: '#ff5d77', focus: '#c92742' },
  { id: 'amber', color: '#f59e0b', hover: '#ffb52e', focus: '#c47d00' },
] as const;

export function applyAccent(id: string): void {
  const apply = (): void => {
    const root = document.documentElement.style;
    const a = ACCENTS.find((x) => x.id === id);
    if (!a || a.id === 'indigo') {
      root.removeProperty('--color-accent');
      root.removeProperty('--color-accent-hover');
      root.removeProperty('--color-accent-focus');
      return;
    }
    root.setProperty('--color-accent', a.color);
    root.setProperty('--color-accent-hover', a.hover);
    root.setProperty('--color-accent-focus', a.focus);
  };
  runWithCrossfade(apply, !accentMounted);
  accentMounted = true;
}

export function applyGlass(on: boolean): void {
  runWithCrossfade(() => {
    const root = document.documentElement;
    if (on) root.setAttribute('data-glass', 'on');
    else root.removeAttribute('data-glass');
  }, !glassMounted);
  glassMounted = true;
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
    applyAccent(settings.accent);
  }, [settings.accent]);

  // in-app CSS 전용. 창 vibrancy 는 토글 시 깜빡여서 폐기 (2026-06-13).
  useEffect(() => {
    applyGlass(settings.liquidGlass);
  }, [settings.liquidGlass]);

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
      autoPublish: { ...prev.autoPublish, ...(patch.autoPublish ?? {}) },
      prompts: { ...prev.prompts, ...(patch.prompts ?? {}) },
      export: { ...prev.export, ...(patch.export ?? {}) },
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
