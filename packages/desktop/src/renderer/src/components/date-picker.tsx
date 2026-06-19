import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../settings-context';
import type { I18nKey } from '../i18n';

const pad2 = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const parseIso = (iso: string): { y: number; m: number; d: number } => {
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10));
  return { y: y ?? 2026, m: (m ?? 1) - 1, d: d ?? 1 };
};

const DOW_KEYS: I18nKey[] = [
  'stats.dow.sun',
  'stats.dow.mon',
  'stats.dow.tue',
  'stats.dow.wed',
  'stats.dow.thu',
  'stats.dow.fri',
  'stats.dow.sat',
];
const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const POP_W = 256;
const POP_H = 322;

type Props = {
  value: string; // YYYY-MM-DD
  max: string; // 선택 상한 (이 날짜 이후 비활성)
  disabled?: boolean;
  onChange: (iso: string) => void;
};

// body portal + 고정 위치(모달에 안 갇힘). pointer-events-auto: Radix 가 body 에 none 을 걸어도 클릭이 먹게.
export function DatePicker({ value, max, disabled, onChange }: Props) {
  const { t, settings } = useSettings();
  const en = settings.language === 'en';
  const sel = parseIso(value);
  const maxD = parseIso(max);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [view, setView] = useState({ y: sel.y, m: sel.m });
  const [picking, setPicking] = useState<'day' | 'month'>('day');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const close = (): void => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 130);
  };

  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent): void => {
      const tgt = e.target as Node;
      if (!triggerRef.current?.contains(tgt) && !popRef.current?.contains(tgt)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, closing]);

  const openPicker = (): void => {
    setView({ y: sel.y, m: sel.m });
    setPicking('day');
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      let top = r.bottom + 6;
      if (top + POP_H > window.innerHeight) top = Math.max(8, r.top - POP_H - 6);
      const left = Math.max(8, Math.min(r.right - POP_W, window.innerWidth - POP_W - 8));
      setPos({ top, left });
    }
    setOpen(true);
  };

  const maxMonthIndex = maxD.y * 12 + maxD.m;
  const viewMonthIndex = view.y * 12 + view.m;
  const monthLabel = en ? `${MONTHS_EN[view.m]} ${view.y}` : `${view.y}년 ${view.m + 1}월`;

  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shiftMonth = (delta: number): void => {
    setView((v) => {
      const idx = v.y * 12 + v.m + delta;
      return { y: Math.floor(idx / 12), m: ((idx % 12) + 12) % 12 };
    });
  };

  const display = en
    ? `${MONTHS_EN[sel.m]} ${sel.d}, ${sel.y}`
    : `${sel.y}. ${pad2(sel.m + 1)}. ${pad2(sel.d)}`;

  const navBtn =
    'flex size-6 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
        className="flex min-w-32 items-center justify-center rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-[13px] text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {display}
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POP_W }}
            className={`${closing ? 'popover-out' : 'popover-in'} glass-panel pointer-events-auto z-[60] rounded-lg border border-hairline bg-surface-1 p-2.5 shadow-xl shadow-black/40`}
          >
            {picking === 'day' ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={() => shiftMonth(-1)} className={navBtn}>
                    <ChevronLeft size={15} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicking('month')}
                    className="rounded-md px-2 py-1 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
                  >
                    {monthLabel}
                  </button>
                  <button
                    type="button"
                    disabled={viewMonthIndex >= maxMonthIndex}
                    onClick={() => shiftMonth(1)}
                    className={navBtn}
                  >
                    <ChevronRight size={15} strokeWidth={2} />
                  </button>
                </div>

                <div className="mb-1 grid grid-cols-7 gap-0.5">
                  {DOW_KEYS.map((k) => (
                    <span key={k} className="py-1 text-center text-[11px] text-ink-tertiary">
                      {t(k)}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((day, i) => {
                    if (day === null) return <span key={`e${i}`} />;
                    const iso = toIso(view.y, view.m, day);
                    const isSelected = iso === value;
                    const isFuture = iso > max;
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isFuture}
                        onClick={() => {
                          onChange(iso);
                          close();
                        }}
                        className={[
                          'flex h-7 items-center justify-center rounded-md text-[12px] transition-colors',
                          isSelected
                            ? 'bg-accent font-medium text-white'
                            : isFuture
                              ? 'cursor-not-allowed text-ink-tertiary/40'
                              : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                        ].join(' ')}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setView((v) => ({ ...v, y: v.y - 1 }))}
                    className={navBtn}
                  >
                    <ChevronLeft size={15} strokeWidth={2} />
                  </button>
                  <span className="text-[13px] font-medium text-ink">
                    {en ? view.y : `${view.y}년`}
                  </span>
                  <button
                    type="button"
                    disabled={view.y >= maxD.y}
                    onClick={() => setView((v) => ({ ...v, y: v.y + 1 }))}
                    className={navBtn}
                  >
                    <ChevronRight size={15} strokeWidth={2} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS_EN.map((mEn, mi) => {
                    const future = view.y * 12 + mi > maxMonthIndex;
                    const isCur = view.y === sel.y && mi === sel.m;
                    return (
                      <button
                        key={mi}
                        type="button"
                        disabled={future}
                        onClick={() => {
                          setView((v) => ({ ...v, m: mi }));
                          setPicking('day');
                        }}
                        className={[
                          'rounded-md py-2 text-[12px] transition-colors',
                          isCur
                            ? 'bg-accent font-medium text-white'
                            : future
                              ? 'cursor-not-allowed text-ink-tertiary/40'
                              : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                        ].join(' ')}
                      >
                        {en ? mEn : `${mi + 1}월`}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
