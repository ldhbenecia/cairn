import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../../settings-context';
import { Toggle } from '../toggle';
import { Field } from './field';

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => i * 30);
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
    <div className="divide-y divide-hairline">
      <Field label={t('prefs.launchAtLogin')} desc={t('prefs.launchAtLogin.desc')}>
        <Toggle checked={settings.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
      </Field>
      <Field label={t('prefs.autoPublish.daily')} desc={t('prefs.autoPublish.dailyDesc')}>
        <Toggle checked={ap.daily} onChange={(v) => set({ daily: v })} />
      </Field>
      <Field label={t('prefs.autoPublish.weekly')} desc={t('prefs.autoPublish.weeklyDesc')}>
        <Toggle checked={ap.weekly} onChange={(v) => set({ weekly: v })} />
      </Field>
      <Field label={t('prefs.autoPublish.monthly')} desc={t('prefs.autoPublish.monthlyDesc')}>
        <Toggle checked={ap.monthly} onChange={(v) => set({ monthly: v })} />
      </Field>

      <Field
        label={t('prefs.autoPublish.time')}
        desc={t('prefs.autoPublish.timeDesc')}
        dim={!anyOn}
      >
        <Select
          value={timeToMinutes(ap.time)}
          options={TIME_SLOTS}
          disabled={!anyOn}
          format={fmtTime}
          menuWidthPx={160}
          onChange={(mins) => set({ time: fmtTime(mins) })}
        />
      </Field>

      <Field
        label={t('prefs.autoPublish.backfill')}
        desc={t('prefs.autoPublish.backfillDesc')}
        dim={!ap.daily}
      >
        <Select
          value={ap.backfillDays}
          options={BACKFILL_DAYS}
          disabled={!ap.daily}
          format={(d) => String(d)}
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

      <p className="pt-5 text-[12px] leading-relaxed text-ink-tertiary">
        {t('prefs.autoPublish.credit')}
      </p>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
  disabled,
  format,
  menuWidthPx,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  disabled?: boolean;
  format: (v: number) => string;
  menuWidthPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = (): void => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 120);
  };

  // 스크롤 컨테이너(설정 내용 영역) 안 absolute 메뉴가 스크롤 범위를 늘려 화면이 밀리던 문제 —
  // DatePicker 와 동일하게 body 포털 + fixed 로 띄운다
  const place = (): void => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = menuWidthPx ?? r.width;
    const h = listRef.current?.offsetHeight ?? 256;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top, left, width });
  };

  useEffect(() => {
    if (!open || closing) return;
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'center' });
    const onDown = (e: MouseEvent): void => {
      if (!triggerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    // 뒤 컨테이너가 스크롤되면 fixed 메뉴가 트리거와 분리되므로 닫는다
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, closing]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : (place(), setOpen(true)))}
        className="flex min-w-20 items-center justify-between gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink hover:bg-surface-3 focus:outline-none disabled:cursor-not-allowed"
      >
        <span className="font-mono">{format(value)}</span>
        <ChevronDown size={13} strokeWidth={2} className="text-ink-subtle" />
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={listRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className={[
              closing ? 'popover-out' : 'popover-in',
              'glass-panel pointer-events-auto z-[70] max-h-64 overflow-y-auto rounded-lg border border-hairline bg-surface-1 p-1 shadow-xl shadow-black/40',
            ].join(' ')}
          >
            {options.map((o) => (
              <button
                key={o}
                type="button"
                data-selected={o === value}
                onClick={() => {
                  onChange(o);
                  close();
                }}
                className={[
                  'flex w-full rounded-md px-3 py-2 font-mono text-[13px]',
                  o === value
                    ? 'bg-accent/25 font-medium text-ink'
                    : 'text-ink-muted hover:bg-surface-2',
                ].join(' ')}
              >
                {format(o)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
