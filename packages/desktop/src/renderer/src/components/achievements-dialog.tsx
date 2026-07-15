import { motion } from 'framer-motion';
import { ArrowLeft, Award, CalendarRange, Check, Copy, FileDown, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { pool, sectionBullets } from '../lib/blocks';
import { DateRangePicker } from './date-picker';
import { useSettings } from '../settings-context';

const RANGES = [30, 90] as const;
const RANGE_LABEL: Record<number, I18nKey> = {
  30: 'achv.range.30',
  90: 'achv.range.90',
};

type Phase = 'select' | 'scanning' | 'result';
type Scanned = { key: string; date: string; count: number };

// N일 전 로컬 날짜(YYYY-MM-DD). 로컬 자정 기준 — KST 단정 금지(timezone 룰)
function localDateDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fmtMD(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${m}.${d}`;
}

const RING_R = 32;
const RING_C = 2 * Math.PI * RING_R;

export function AchievementsDialog({
  recent,
  onClose,
}: {
  recent: RecentListResult | null;
  onClose: () => void;
}) {
  const { t } = useSettings();
  const [days, setDays] = useState<number | 'custom'>(90);
  const [customFrom, setCustomFrom] = useState<string>(localDateDaysAgo(30));
  const [customTo, setCustomTo] = useState<string>(todayLocal());
  const [phase, setPhase] = useState<Phase>('select');
  const [scanTotal, setScanTotal] = useState(0);
  const [scanned, setScanned] = useState<Scanned[]>([]);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    worklogs: number;
    done: number;
    pr: number;
    commit: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 자체 오버레이(Radix 아님)라 ESC 닫기를 직접 — 다른 다이얼로그와 동작 통일
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const countInRange = (r: number): number =>
    (recent?.pages ?? []).filter(
      (p) => p.category === 'daily' && p.date != null && p.date >= localDateDaysAgo(r),
    ).length;
  const maxCount = Math.max(1, countInRange(90));

  const since = days === 'custom' ? customFrom : localDateDaysAgo(days);
  const until = days === 'custom' ? customTo : todayLocal();
  const pages = (recent?.pages ?? []).filter(
    (p) => p.category === 'daily' && p.date != null && p.date >= since && p.date <= until,
  );

  async function compile() {
    setPhase('scanning');
    setScanned([]);
    setMarkdown(null);
    setStats(null);
    const target = [...pages].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    setScanTotal(target.length);
    const perDay = await pool(target, 4, async (p) => {
      const date = p.date as string;
      if (!alive.current) return { date, bullets: [] as string[] };
      try {
        const content = await window.cairn.pageContent(p.pageId, p.workspaceLabel);
        if (!alive.current) return { date, bullets: [] as string[] };
        const bullets = sectionBullets(content.blocks, 'done');
        setScanned((prev) => [...prev, { key: p.pageId, date, count: bullets.length }]);
        return { date, bullets };
      } catch {
        if (alive.current) setScanned((prev) => [...prev, { key: p.pageId, date, count: 0 }]);
        return { date, bullets: [] as string[] };
      }
    });
    if (!alive.current) return;
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
    const doneTotal = perDay.reduce((n, d) => n + d.bullets.length, 0);
    // PR·커밋 수치는 로컬 통계(RecentPage.pr/commit) 합산 — 추가 노션 호출 없음
    const pr = target.reduce((n, p) => n + (p.pr ?? 0), 0);
    const commit = target.reduce((n, p) => n + (p.commit ?? 0), 0);
    const header = `# ${since} ~ ${until}\n\n${t('achv.mdHeader')
      .replace('{n}', String(target.length))
      .replace('{pr}', String(pr))
      .replace('{commit}', String(commit))}`;
    setStats({ worklogs: target.length, done: doneTotal, pr, commit });
    // Done 항목이 없어도 기간·수치 헤더는 보여준다 (#239 리뷰)
    setMarkdown(md ? `${header}\n\n${md}` : header);
    setPhase('result');
  }

  function reset() {
    setPhase('select');
    setScanned([]);
    setMarkdown(null);
    setStats(null);
  }

  function copy() {
    if (!markdown) return;
    void navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function saveMd() {
    if (!markdown) return;
    void window.cairn.exportMarkdown(filename, markdown).then((r) => {
      if (!r.saved) return;
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const scanDone = scanned.length;
  const ringPct = scanTotal > 0 ? Math.round((scanDone / scanTotal) * 100) : 0;
  const ringOffset = RING_C * (1 - (scanTotal > 0 ? scanDone / scanTotal : 0));
  const recentScan = scanned.slice(-5);
  const filename = days === 'custom' ? `worklog-${since}-${until}.md` : `worklog-last-${days}d.md`;
  const wide = phase === 'result';

  return (
    <motion.div
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6 [-webkit-app-region:no-drag]"
    >
      <motion.div
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`glass-panel flex max-h-[80vh] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          wide ? 'w-[560px]' : 'w-[440px]'
        }`}
      >
        <div className="flex items-start justify-between border-b border-hairline px-6 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent/12 text-accent-hover">
              <Award size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{t('achv.title')}</p>
              <p className="mt-0.5 text-[12px] text-ink-tertiary">{t('achv.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('publish.close')}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {phase === 'select' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {RANGES.map((r) => {
                  const selected = days === r;
                  const count = countInRange(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDays(r)}
                      className={[
                        'relative flex flex-col items-start rounded-xl border px-4 py-3.5 text-left transition-all active:scale-[0.99]',
                        selected
                          ? 'border-accent bg-accent/10 shadow-sm shadow-accent/15'
                          : 'border-hairline hover:border-hairline-strong hover:bg-surface-2/60',
                      ].join(' ')}
                    >
                      {selected && (
                        <span className="batch-pop absolute top-3 right-3 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                      <span
                        className={`text-[13px] font-medium ${selected ? 'text-ink' : 'text-ink-muted'}`}
                      >
                        {t(RANGE_LABEL[r]!)}
                      </span>
                      <span className="mt-1 font-mono text-[10.5px] tracking-wide text-ink-tertiary">
                        {fmtMD(localDateDaysAgo(r))} — {fmtMD(todayLocal())}
                      </span>
                      <span className="mt-3 font-mono text-[20px] leading-none font-semibold text-ink">
                        {count}
                        <span className="ml-1 font-sans text-[10px] font-normal text-ink-tertiary">
                          {t('achv.worklogs').trim()}
                        </span>
                      </span>
                      <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover"
                          style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* DatePicker(button)를 품어야 해서 button 중첩 대신 div */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDays('custom')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setDays('custom');
                }}
                className={[
                  'relative flex cursor-pointer flex-col items-start rounded-xl border px-4 py-3.5 text-left transition-all active:scale-[0.99]',
                  days === 'custom'
                    ? 'border-accent bg-accent/10 shadow-sm shadow-accent/15'
                    : 'border-hairline hover:border-hairline-strong hover:bg-surface-2/60',
                ].join(' ')}
              >
                {days === 'custom' && (
                  <span className="batch-pop absolute top-3 right-3 flex size-4 items-center justify-center rounded-full bg-accent text-white">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
                <span
                  className={`flex items-center gap-1.5 text-[13px] font-medium ${days === 'custom' ? 'text-ink' : 'text-ink-muted'}`}
                >
                  <CalendarRange size={13} strokeWidth={2} />
                  {t('achv.range.custom')}
                </span>
                {days === 'custom' ? (
                  <span
                    className="mt-2.5 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DateRangePicker
                      value={{ from: customFrom, to: customTo }}
                      max={todayLocal()}
                      onChange={(r) => {
                        setCustomFrom(r.from);
                        setCustomTo(r.to);
                      }}
                    />
                    <span className="ml-1 font-mono text-[12px] text-ink-tertiary tabular-nums">
                      {pages.length}
                      {t('achv.worklogs')}
                    </span>
                  </span>
                ) : (
                  <span className="mt-1 font-mono text-[10.5px] tracking-wide text-ink-tertiary">
                    {fmtMD(customFrom)} — {fmtMD(customTo)}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-hairline bg-surface-2/40 px-3.5 py-3">
                <Info size={15} strokeWidth={2} className="mt-px shrink-0 text-accent-hover" />
                <span className="text-[11.5px] leading-relaxed text-ink-muted">
                  {t('achv.info')}
                </span>
              </div>

              <button
                type="button"
                disabled={pages.length === 0}
                onClick={() => void compile()}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {pages.length}
                {t('achv.worklogs')} {t('achv.compile')}
              </button>
            </>
          )}

          {phase === 'scanning' && (
            <div className="flex flex-col items-center pt-2 pb-1">
              <div className="size-24">
                <svg width="96" height="96" viewBox="0 0 80 80" className="block">
                  <circle
                    cx="40"
                    cy="40"
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-surface-2)"
                    strokeWidth="7"
                  />
                  <motion.circle
                    cx="40"
                    cy="40"
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    transform="rotate(-90 40 40)"
                    initial={false}
                    animate={{ strokeDashoffset: ringOffset }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />
                  <text
                    x="40"
                    y="40"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-mono font-semibold tabular-nums"
                    fontSize="17"
                    fill="var(--color-ink)"
                  >
                    {ringPct}%
                  </text>
                </svg>
              </div>
              <p className="mt-4 text-[14px] font-medium text-ink">{t('achv.scanning')}</p>
              <p className="mt-1 text-[11.5px] text-ink-tertiary tabular-nums">
                <span className="font-mono text-accent-hover">{scanDone}</span> / {scanTotal}
                {t('achv.worklogs')}
              </p>
              <div className="mt-4 flex h-[132px] w-full flex-col justify-end gap-1.5 overflow-hidden rounded-xl border border-hairline bg-surface-2/40 px-3.5 py-3">
                {recentScan.map((s) => (
                  <div key={s.key} className="flex items-center gap-2.5">
                    <Check size={13} strokeWidth={2.5} className="shrink-0 text-success" />
                    <span className="font-mono text-[11.5px] text-ink-muted">{s.date}</span>
                    <span className="ml-auto font-mono text-[11px] text-ink-tertiary tabular-nums">
                      {s.count} {t('achv.done')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {phase === 'result' &&
            (markdown ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-md bg-success/12 px-2.5 py-1 text-[11.5px] font-medium text-success">
                    <Check size={13} strokeWidth={2.5} />
                    {t('achv.complete')}
                  </span>
                  {stats && (
                    <span className="rounded-md bg-accent/10 px-2.5 py-1 font-mono text-[11.5px] text-accent-hover">
                      {stats.worklogs}
                      {t('achv.worklogs')} · {stats.done} {t('achv.done')} · PR {stats.pr} ·{' '}
                      {t('achv.commits')} {stats.commit}
                    </span>
                  )}
                </div>

                <div className="overflow-hidden rounded-xl border border-hairline bg-canvas">
                  <div className="flex items-center gap-2 border-b border-hairline bg-surface-2/40 px-3.5 py-2.5">
                    <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="size-2.5 rounded-full bg-[#febc2e]" />
                    <span className="size-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-1.5 font-mono text-[11.5px] text-ink-subtle">
                      {filename}
                    </span>
                    <button
                      type="button"
                      onClick={saveMd}
                      className={`ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition-colors ${
                        saved
                          ? 'bg-success/15 text-success'
                          : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {saved ? (
                        <Check size={13} strokeWidth={2.5} />
                      ) : (
                        <FileDown size={13} strokeWidth={2} />
                      )}
                      {saved ? t('achv.saved') : t('achv.save')}
                    </button>
                    <button
                      type="button"
                      onClick={copy}
                      className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition-colors ${
                        copied
                          ? 'bg-success/15 text-success'
                          : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
                      }`}
                    >
                      {copied ? (
                        <Check size={13} strokeWidth={2.5} />
                      ) : (
                        <Copy size={13} strokeWidth={2} />
                      )}
                      {copied ? t('drawer.copied') : t('achv.copy')}
                    </button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto px-4 py-3 font-mono">
                    {markdown.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return (
                          <div
                            key={i}
                            className="mt-3 mb-1 text-[12.5px] font-semibold text-accent-hover first:mt-0"
                          >
                            {line}
                          </div>
                        );
                      }
                      if (line.startsWith('- ')) {
                        return (
                          <div key={i} className="text-[12px] leading-relaxed text-ink-muted">
                            {line}
                          </div>
                        );
                      }
                      if (line.startsWith('# ')) {
                        return (
                          <div key={i} className="text-[13px] font-semibold text-ink">
                            {line}
                          </div>
                        );
                      }
                      if (line.trim().length > 0) {
                        return (
                          <div key={i} className="text-[12px] text-ink-tertiary">
                            {line}
                          </div>
                        );
                      }
                      return <div key={i} className="h-2" />;
                    })}
                  </div>
                </div>

                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <ArrowLeft size={13} strokeWidth={2} />
                    {t('achv.back')}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="rounded-md border border-hairline py-8 text-center text-[12px] text-ink-tertiary">
                  {t('achv.empty')}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 self-start rounded-md border border-hairline px-3 py-2 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <ArrowLeft size={13} strokeWidth={2} />
                  {t('achv.back')}
                </button>
              </div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
