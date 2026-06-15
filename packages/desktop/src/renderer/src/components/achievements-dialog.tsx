import { Check, Copy, Loader2, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { pool, sectionBullets } from '../lib/blocks';
import { useSettings } from '../settings-context';

const RANGES = [30, 90] as const;
const RANGE_LABEL: Record<number, I18nKey> = {
  30: 'achv.range.30',
  90: 'achv.range.90',
};

// N일 전 로컬 날짜(YYYY-MM-DD). 로컬 자정 기준 — KST 단정 금지(timezone 룰).
function localDateDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function AchievementsDialog({
  recent,
  onClose,
}: {
  recent: RecentListResult | null;
  onClose: () => void;
}) {
  const { t } = useSettings();
  const [days, setDays] = useState<number>(90);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const since = localDateDaysAgo(days);
  const pages = (recent?.pages ?? []).filter(
    (p) => p.category === 'daily' && p.date != null && p.date >= since,
  );

  async function compile() {
    setBusy(true);
    setMarkdown(null);
    setProgress({ done: 0, total: pages.length });
    const target = [...pages].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const perDay = await pool(
      target,
      4,
      async (p) => {
        try {
          const content = await window.cairn.pageContent(p.pageId, p.workspaceLabel);
          return { date: p.date as string, bullets: sectionBullets(content.blocks, 'done') };
        } catch {
          return { date: p.date as string, bullets: [] as string[] };
        }
      },
      (done, total) => setProgress({ done, total }),
    );
    const byMonth = new Map<string, string[]>();
    for (const d of perDay) {
      if (d.bullets.length === 0) continue;
      const month = d.date.slice(0, 7);
      const bucket = byMonth.get(month) ?? [];
      bucket.push(...d.bullets);
      byMonth.set(month, bucket);
    }
    const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));
    const md = months
      .map(
        (m) =>
          `## ${m}\n\n${byMonth
            .get(m)!
            .map((b) => `- ${b}`)
            .join('\n')}`,
      )
      .join('\n\n');
    setMarkdown(md);
    setProgress(null);
    setBusy(false);
  }

  function copy() {
    if (!markdown) return;
    void navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 pt-[10vh] [-webkit-app-region:no-drag]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="glass-panel flex max-h-[80vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between border-b border-hairline px-6 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/12 text-accent-hover">
              <Sparkles size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{t('achv.title')}</p>
              <p className="mt-0.5 text-[12px] text-ink-tertiary">{t('achv.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-2">
            {RANGES.map((r) => {
              const selected = days === r;
              const count = (recent?.pages ?? []).filter(
                (p) => p.category === 'daily' && p.date != null && p.date >= localDateDaysAgo(r),
              ).length;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={busy}
                  onClick={() => setDays(r)}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 transition-all active:scale-[0.99] disabled:opacity-50',
                    selected
                      ? 'border-accent bg-accent/10 shadow-sm shadow-accent/15'
                      : 'border-hairline hover:border-hairline-strong hover:bg-surface-2/60',
                  ].join(' ')}
                >
                  <span
                    className={`text-[13px] font-medium ${selected ? 'text-ink' : 'text-ink-muted'}`}
                  >
                    {t(RANGE_LABEL[r]!)}
                  </span>
                  <span className="text-[12px] text-ink-tertiary">
                    {count}
                    {t('achv.worklogs')}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={busy || pages.length === 0}
            onClick={() => void compile()}
            className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {busy ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <Sparkles size={14} strokeWidth={2} />
            )}
            {busy && progress ? `${progress.done} / ${progress.total}` : t('achv.compile')}
          </button>

          {markdown !== null &&
            (markdown === '' ? (
              <p className="rounded-md border border-hairline bg-surface-1 py-8 text-center text-[12px] text-ink-tertiary">
                {t('achv.empty')}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-tertiary">{t('achv.preview')}</span>
                  <button
                    type="button"
                    onClick={copy}
                    className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors ${
                      copied
                        ? 'bg-success/15 text-success'
                        : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    {copied ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : (
                      <Copy size={14} strokeWidth={2} />
                    )}
                    {copied ? t('drawer.copied') : t('achv.copy')}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={markdown}
                  rows={14}
                  className="w-full resize-none rounded-md border border-hairline bg-surface-2 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-muted focus:outline-none"
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
