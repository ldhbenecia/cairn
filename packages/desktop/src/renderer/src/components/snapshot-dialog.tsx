import { motion } from 'framer-motion';
import { History, Loader2, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { JournalSnapshotMeta, RecentPage } from '../cairn-api';
import { diffLines, type DiffLine } from '../lib/diff';
import { useSettings } from '../settings-context';

export function SnapshotDialog({
  page,
  onClose,
  onRestored,
}: {
  page: RecentPage;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { t, settings } = useSettings();
  const [snaps, setSnaps] = useState<JournalSnapshotMeta[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [restoring, setRestoring] = useState(false);
  const date = page.date ?? '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    void window.cairn.snapshots.list(page.category, date).then((list) => {
      if (!alive) return;
      setSnaps(list);
      if (list.length > 0) setSelected(list[0]!.stamp);
    });
    return () => {
      alive = false;
    };
  }, [page.category, date]);

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setDiff(null);
    void Promise.all([
      window.cairn.snapshots.read(page.category, date, selected),
      window.cairn.snapshots.read(page.category, date, 'current'),
    ]).then(([snap, current]) => {
      if (!alive) return;
      if (snap.content === null || current.content === null) {
        setDiff([]);
        return;
      }
      setDiff(diffLines(snap.content, current.content));
    });
    return () => {
      alive = false;
    };
  }, [selected, page.category, date]);

  async function restore() {
    if (!selected || restoring) return;
    setRestoring(true);
    const r = await window.cairn.snapshots.restore(page.category, date, selected);
    setRestoring(false);
    if (r.ok) {
      onRestored();
      onClose();
    }
  }

  const fmt = (iso: string): string =>
    new Date(iso).toLocaleString(settings.language === 'ko' ? 'ko-KR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <motion.div
      onPointerDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 [-webkit-app-region:no-drag]"
    >
      <motion.div
        onPointerDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel flex max-h-[78vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-3 border-b border-hairline px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <History size={15} strokeWidth={2} className="text-ink-tertiary" />
              {t('snap.title')}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-tertiary">
              {page.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('drawer.close')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {snaps === null ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[12px] text-ink-tertiary">
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            {t('snap.loading')}
          </div>
        ) : snaps.length === 0 ? (
          <p className="px-6 py-14 text-center text-[13px] text-ink-tertiary">{t('snap.empty')}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-hairline px-6 py-3">
              {snaps.map((s) => (
                <button
                  key={s.stamp}
                  type="button"
                  onClick={() => setSelected(s.stamp)}
                  className={[
                    'rounded-md border px-2.5 py-1 font-mono text-[11.5px] transition-colors',
                    selected === s.stamp
                      ? 'border-accent/50 bg-accent/15 text-ink'
                      : 'border-hairline text-ink-muted hover:bg-surface-2 hover:text-ink',
                  ].join(' ')}
                >
                  {fmt(s.at)}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              {diff === null ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-ink-tertiary">
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                  {t('snap.loading')}
                </div>
              ) : (
                <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                  {diff.map((l, i) => (
                    <div
                      key={i}
                      className={
                        l.type === 'del'
                          ? 'bg-danger/10 text-danger'
                          : l.type === 'add'
                            ? 'bg-success/10 text-success'
                            : 'text-ink-muted'
                      }
                    >
                      {l.type === 'del' ? '- ' : l.type === 'add' ? '+ ' : '  '}
                      {l.text}
                    </div>
                  ))}
                </pre>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-hairline px-6 py-3.5">
              <span className="text-[11.5px] text-ink-tertiary">{t('snap.legend')}</span>
              <button
                type="button"
                disabled={!selected || restoring}
                onClick={() => void restore()}
                className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 text-[13px] text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {restoring ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} strokeWidth={2} />
                )}
                {t('snap.restore')}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
