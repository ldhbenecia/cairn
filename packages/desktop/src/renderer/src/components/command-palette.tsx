import { BarChart3, FileText, Plus, Search, Settings, SquareArrowOutUpRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CoreMode, RecentListResult, RecentPage } from '../cairn-api';
import { useSettings } from '../settings-context';

type Cmd = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void };

type Props = {
  recent: RecentListResult | null;
  onClose: () => void;
  onView: (v: 'stats' | 'worklogs') => void;
  onPreferences: () => void;
  onPublish: (mode: CoreMode) => void;
  onOpenPage: (page: RecentPage) => void;
};

export function CommandPalette({
  recent,
  onClose,
  onView,
  onPreferences,
  onPublish,
  onOpenPage,
}: Props) {
  const { t } = useSettings();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands: Cmd[] = useMemo(() => {
    const plus = <Plus size={12} strokeWidth={2} />;
    return [
      {
        id: 'pub-daily',
        label: t('cmd.publishToday'),
        icon: plus,
        run: () => onPublish('daily'),
      },
      {
        id: 'pub-weekly',
        label: t('cmd.publishWeek'),
        icon: plus,
        run: () => onPublish('weekly'),
      },
      {
        id: 'pub-monthly',
        label: t('cmd.publishMonth'),
        icon: plus,
        run: () => onPublish('monthly'),
      },
      {
        id: 'view-stats',
        label: t('cmd.stats'),
        icon: <BarChart3 size={12} strokeWidth={2} />,
        run: () => onView('stats'),
      },
      {
        id: 'view-worklogs',
        label: t('cmd.worklogs'),
        icon: <FileText size={12} strokeWidth={2} />,
        run: () => onView('worklogs'),
      },
      {
        id: 'prefs',
        label: t('cmd.preferences'),
        icon: <Settings size={12} strokeWidth={2} />,
        run: onPreferences,
      },
    ];
  }, [t, onPublish, onView, onPreferences]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    const cmds = commands.filter((c) => !query || c.label.toLowerCase().includes(query));
    const pages: Cmd[] =
      query.length >= 2
        ? (recent?.pages ?? [])
            .filter((p) => p.title.toLowerCase().includes(query))
            .slice(0, 6)
            .map((p) => ({
              id: p.pageId,
              label: p.title,
              hint: t('cmd.openWorklog'),
              icon: <SquareArrowOutUpRight size={12} strokeWidth={2} />,
              run: () => onOpenPage(p),
            }))
        : [];
    return [...cmds, ...pages];
  }, [q, commands, recent, t, onOpenPage]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  function run(cmd: Cmd | undefined) {
    if (!cmd) return;
    cmd.run();
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(items[sel]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[14vh] [-webkit-app-region:no-drag]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="glass-panel w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <Search size={15} strokeWidth={2} className="shrink-0 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('cmd.placeholder')}
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-ink-tertiary focus:outline-none"
          />
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-ink-tertiary">
              {t('cmd.noMatch')}
            </p>
          ) : (
            items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => run(it)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                  i === sel ? 'bg-accent/15 text-ink' : 'text-ink-muted'
                }`}
              >
                <span className={i === sel ? 'text-accent-hover' : 'text-ink-tertiary'}>
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.hint && (
                  <span className="shrink-0 text-[11px] text-ink-tertiary">{it.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
