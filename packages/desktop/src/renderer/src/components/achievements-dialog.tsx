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
        className="glass-panel flex max-h-[80vh] w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
              <Sparkles size={15} strokeWidth={2} className="text-accent-hover" />
              {t('achv.title')}
            </p>
            <p className="mt-0.5 text-[12px] text-ink-tertiary">{t('achv.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busy}
                onClick={() => setDays(r)}
                className={`rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
                  days === r
                    ? 'border-accent/60 bg-accent/15 text-ink'
                    : 'border-hairline text-ink-muted hover:bg-surface-2'
                }`}
              >
                {t(RANGE_LABEL[r]!)}
              </button>
            ))}
            <span className="ml-auto text-[12px] text-ink-tertiary">
              {pages.length}
              {t('achv.worklogs')}
            </span>
          </div>

          <button
            type="button"
            disabled={busy || pages.length === 0}
            onClick={() => void compile()}
            className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
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
