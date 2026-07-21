import { Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSettings } from '../../settings-context';
import { Toggle } from '../toggle';
import { Field, Section } from './field';

const BACKFILL_DAYS = [0, 1, 2, 3, 5, 7, 10, 14, 30];
const pad2 = (n: number): string => String(n).padStart(2, '0');
const fmtTime = (mins: number): string => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
const timeToMinutes = (t: string): number => {
  const [h = 19, m = 0] = t.split(':').map((n) => Number.parseInt(n, 10));
  return (Number.isFinite(h) ? h : 19) * 60 + (Number.isFinite(m) ? m : 0);
};

export function AutoPublishTab() {
  const { settings, update, t } = useSettings();
  const ap = settings.autoPublish;
  const anyOn = ap.daily || ap.weekly || ap.monthly;
  const set = (patch: Partial<typeof ap>): void => update({ autoPublish: { ...ap, ...patch } });

  return (
    <div className="flex flex-col gap-9">
      <Section label={t('prefs.section.general')}>
        <Field label={t('prefs.launchAtLogin')} desc={t('prefs.launchAtLogin.desc')}>
          <Toggle checked={settings.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
        </Field>
      </Section>

      <Section label={t('prefs.section.schedule')}>
        <Field label={t('prefs.autoPublish.daily')} desc={t('prefs.autoPublish.dailyDesc')}>
          <Toggle checked={ap.daily} onChange={(v) => set({ daily: v })} />
        </Field>
        <Field label={t('prefs.autoPublish.weekly')} desc={t('prefs.autoPublish.weeklyDesc')}>
          <Toggle checked={ap.weekly} onChange={(v) => set({ weekly: v })} />
        </Field>
        <Field label={t('prefs.autoPublish.monthly')} desc={t('prefs.autoPublish.monthlyDesc')}>
          <Toggle checked={ap.monthly} onChange={(v) => set({ monthly: v })} />
        </Field>
      </Section>

      <Section label={t('prefs.section.options')}>
        <Field
          label={t('prefs.autoPublish.time')}
          desc={t('prefs.autoPublish.timeDesc')}
          dim={!anyOn}
        >
          <TimeField value={ap.time} disabled={!anyOn} onChange={(v) => set({ time: v })} />
        </Field>

        <Field
          label={t('prefs.autoPublish.backfill')}
          desc={t('prefs.autoPublish.backfillDesc')}
          dim={!ap.daily}
        >
          <ChipGroup
            value={ap.backfillDays}
            options={BACKFILL_DAYS}
            disabled={!ap.daily}
            onChange={(d) => set({ backfillDays: d })}
          />
        </Field>

        <Field
          label={t('prefs.autoPublish.confirm')}
          desc={t('prefs.autoPublish.confirmDesc')}
          dim={!anyOn}
        >
          <Toggle
            checked={ap.confirmBeforeRun}
            disabled={!anyOn}
            onChange={(v) => set({ confirmBeforeRun: v })}
          />
        </Field>

        <p className="pt-4 text-[12px] leading-relaxed text-ink-tertiary">
          {t('prefs.autoPublish.credit')}
        </p>
      </Section>
    </div>
  );
}

// 환경설정 안 긴 세로 드롭다운 대체 — 오버레이 없이 인라인으로 완결
function TimeField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const { t } = useSettings();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (raw: string): void => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!m) {
      setText(value);
      return;
    }
    const h = Math.min(23, Math.max(0, Number(m[1])));
    const min = Math.min(59, Math.max(0, Number(m[2])));
    const next = `${pad2(h)}:${pad2(min)}`;
    setText(next);
    if (next !== value) onChange(next);
  };

  // blur 커밋 직후 클로저의 value 가 stale 할 수 있어(#245 리뷰) 스텝 기준은 현재 입력 텍스트
  const step = (deltaMin: number): void => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
    const base = m
      ? Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))
      : timeToMinutes(value);
    const next = fmtTime((((base + deltaMin) % 1440) + 1440) % 1440);
    setText(next);
    onChange(next);
  };

  const stepBtn =
    'flex size-7 items-center justify-center rounded-md border border-hairline text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={t('prefs.autoPublish.time.minus')}
        disabled={disabled}
        onClick={() => step(-30)}
        className={stepBtn}
      >
        <Minus size={13} strokeWidth={2} />
      </button>
      <input
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
        }}
        className="w-[4.5rem] rounded-md border border-hairline bg-surface-2 px-2 py-1.5 text-center font-mono text-[13px] text-ink outline-none focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
      />
      <button
        type="button"
        aria-label={t('prefs.autoPublish.time.plus')}
        disabled={disabled}
        onClick={() => step(30)}
        className={stepBtn}
      >
        <Plus size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

function ChipGroup({
  value,
  options,
  disabled,
  onChange,
}: {
  value: number;
  options: number[];
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex max-w-[340px] flex-wrap justify-end gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          disabled={disabled}
          onClick={() => onChange(o)}
          className={[
            'rounded-md border px-2.5 py-1 font-mono text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            o === value
              ? 'border-hairline-strong bg-surface-3 text-ink'
              : 'border-hairline text-ink-muted hover:bg-surface-2 hover:text-ink',
          ].join(' ')}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
