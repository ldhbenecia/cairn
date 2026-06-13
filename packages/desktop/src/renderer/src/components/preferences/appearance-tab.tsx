import { Check } from 'lucide-react';
import type { Language, Theme } from '../../cairn-api';
import { ACCENTS, useSettings } from '../../settings-context';
import { Field, Segmented } from './field';

export function AppearanceTab() {
  const { settings, update, t } = useSettings();
  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'system', label: t('prefs.theme.system') },
    { value: 'light', label: t('prefs.theme.light') },
    { value: 'dark', label: t('prefs.theme.dark') },
  ];
  const langOptions: { value: Language; label: string }[] = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
  ];

  return (
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.theme')} desc={t('prefs.theme.desc')}>
        <div className="flex gap-3">
          {themeOptions.map((o) => (
            <ThemeCard
              key={o.value}
              value={o.value}
              label={o.label}
              selected={settings.theme === o.value}
              onSelect={() => update({ theme: o.value })}
            />
          ))}
        </div>
      </Field>

      <Field label={t('prefs.glass')} desc={t('prefs.glass.desc')}>
        <div className="flex gap-3">
          <GlassCard
            glass={false}
            label={t('prefs.glass.default')}
            selected
            onSelect={() => update({ liquidGlass: false })}
          />
          <GlassCard
            glass
            label={t('prefs.glass.on')}
            selected={false}
            disabled
            soon={t('prefs.glass.soon')}
            onSelect={() => undefined}
          />
        </div>
      </Field>

      <Field label={t('prefs.accent')} desc={t('prefs.accent.desc')}>
        <div className="flex gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-label={a.id}
              onClick={() => update({ accent: a.id })}
              className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105"
              style={{ background: a.color }}
            >
              {settings.accent === a.id && (
                <Check size={14} strokeWidth={3} className="text-white" />
              )}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('prefs.language')} desc={t('prefs.language.desc')}>
        <Segmented
          options={langOptions}
          value={settings.language}
          onChange={(v) => update({ language: v })}
        />
      </Field>
    </div>
  );
}

const MOCK_PALETTE: Record<'light' | 'dark', { bg: string; win: string; line: string }> = {
  light: { bg: '#e6e7ea', win: '#ffffff', line: '#cfd2d8' },
  dark: { bg: '#1b1b20', win: '#26262c', line: '#3a3a42' },
};

function Mock({ variant }: { variant: 'light' | 'dark' }) {
  const p = MOCK_PALETTE[variant];
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ background: p.bg }}>
      <div
        className="flex h-[74%] w-[78%] flex-col gap-0.75 rounded-[5px] p-1.5"
        style={{ background: p.win, boxShadow: '0 1px 2px rgba(0,0,0,0.22)' }}
      >
        <div className="flex gap-0.75">
          <span className="size-1 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="size-1 rounded-full" style={{ background: '#febc2e' }} />
          <span className="size-1 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <div className="mt-0.5 h-0.75 w-2/3 rounded-full bg-accent" />
        <div className="h-0.75 w-full rounded-full" style={{ background: p.line }} />
        <div className="h-0.75 w-4/5 rounded-full" style={{ background: p.line }} />
      </div>
    </div>
  );
}

function AutoMock() {
  return (
    <div className="relative h-full w-full">
      <Mock variant="light" />
      <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
        <Mock variant="dark" />
      </div>
    </div>
  );
}

function ThemeCard({
  value,
  label,
  selected,
  onSelect,
}: {
  value: Theme;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="group flex flex-col items-center gap-2">
      <span
        className={[
          'relative block h-16 w-24 overflow-hidden rounded-lg border-2 transition-colors',
          selected ? 'border-accent' : 'border-hairline group-hover:border-hairline-strong',
        ].join(' ')}
      >
        {value === 'system' ? <AutoMock /> : <Mock variant={value} />}
        {selected && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-accent text-white shadow">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <span
        className={['text-[12px]', selected ? 'font-semibold text-ink' : 'text-ink-subtle'].join(
          ' ',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function GlassMock({ glass }: { glass: boolean }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: glass ? 'linear-gradient(135deg, #5b61e6, #16a89a)' : '#1b1b20' }}
    >
      <div
        className="h-[74%] w-[78%] rounded-[5px] border"
        style={
          glass
            ? {
                background: 'rgba(255,255,255,0.14)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderColor: 'rgba(255,255,255,0.28)',
              }
            : { background: '#26262c', borderColor: '#3a3a42' }
        }
      />
    </div>
  );
}

function GlassCard({
  glass,
  label,
  selected,
  onSelect,
  disabled = false,
  soon,
}: {
  glass: boolean;
  label: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  soon?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className="group flex flex-col items-center gap-2 disabled:cursor-not-allowed"
    >
      <span
        className={[
          'relative block h-16 w-24 overflow-hidden rounded-lg border-2 transition-colors',
          selected ? 'border-accent' : 'border-hairline group-hover:border-hairline-strong',
          disabled ? 'opacity-45' : '',
        ].join(' ')}
      >
        {soon && (
          <span className="absolute top-1 left-1 z-10 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
            {soon}
          </span>
        )}
        <GlassMock glass={glass} />
        {selected && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-accent text-white shadow">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </span>
      <span
        className={['text-[12px]', selected ? 'font-semibold text-ink' : 'text-ink-subtle'].join(
          ' ',
        )}
      >
        {label}
      </span>
    </button>
  );
}
