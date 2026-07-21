import { motion } from 'framer-motion';
import { Check, Download, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult, RecentPage } from '../cairn-api';
import { pool, sectionBullets } from '../lib/blocks';
import { LANE_COLORS } from '../lib/reports';
import { availableYears, computeWrapped, topProjects, type WrappedStats } from '../lib/wrapped';
import { useSettings } from '../settings-context';

type Project = { name: string; count: number };

export function WrappedDialog({
  recent,
  onClose,
}: {
  recent: RecentListResult | null;
  onClose: () => void;
}) {
  const { t } = useSettings();
  const pages = useMemo(() => recent?.pages ?? [], [recent]);
  const years = useMemo(() => availableYears(pages), [pages]);
  const [year, setYear] = useState<string | null>(years[0] ?? null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const projectCache = useRef(new Map<string, Project[]>());

  const stats = useMemo(() => (year ? computeWrapped(pages, year) : null), [pages, year]);

  useEffect(() => {
    if ((!year || !years.includes(year)) && years[0]) setYear(years[0]);
  }, [years, year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!year) return;
    const targets = pages.filter((p) => p.category === 'daily' && p.date?.startsWith(`${year}-`));
    // 캐시 키에 일지 수 포함 — recent 갱신으로 그 해 일지가 늘면 재스캔
    const cacheKey = `${year}:${targets.length}`;
    const cached = projectCache.current.get(cacheKey);
    if (cached) {
      setProjects(cached);
      return;
    }
    let alive = true;
    setProjects(null);
    setScan({ done: 0, total: targets.length });
    void (async () => {
      const perPage = await pool(
        targets,
        6,
        async (p: RecentPage) => {
          try {
            const c = await window.cairn.pageContent(p.pageId, p.workspaceLabel);
            return sectionBullets(c.blocks, 'done');
          } catch {
            return [];
          }
        },
        (done, total) => {
          if (alive) setScan({ done, total });
        },
      );
      if (!alive) return;
      const top = topProjects(perPage.flat());
      projectCache.current.set(cacheKey, top);
      setProjects(top);
      setScan(null);
    })();
    return () => {
      alive = false;
    };
  }, [year, pages]);

  async function savePng() {
    if (!stats || save === 'saving') return;
    setSave('saving');
    try {
      const dataUrl = drawShareCard(stats, {
        title: t('wrapped.title'),
        pr: t('stats.totalPr'),
        commit: t('stats.totalCommit'),
        activeDays: t('stats.activeDays'),
        streak: t('stats.streak'),
      });
      const r = await window.cairn.exportPng(`cairn-wrapped-${stats.year}.png`, dataUrl);
      if (r.saved) {
        setSave('saved');
        setTimeout(() => setSave('idle'), 1500);
      } else {
        setSave(r.error ? 'error' : 'idle');
      }
    } catch {
      setSave('error');
    }
  }

  const monthMax = stats ? Math.max(1, ...stats.byMonth.map((m) => m.pr + m.commit)) : 1;
  const dowMax = stats ? Math.max(1, ...stats.byWeekday) : 1;
  const DOW_KEYS = [
    'stats.dow.sun',
    'stats.dow.mon',
    'stats.dow.tue',
    'stats.dow.wed',
    'stats.dow.thu',
    'stats.dow.fri',
    'stats.dow.sat',
  ] as const;

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
        className="glass-panel flex max-h-[84vh] w-[620px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="relative shrink-0 px-6 pt-6 pb-1">
          <button
            type="button"
            onClick={onClose}
            title={t('drawer.close')}
            className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={15} strokeWidth={2} />
          </button>
          <p className="text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
            {t('wrapped.title')}
          </p>
          <h2 className="mt-1 text-[40px] leading-none font-semibold tracking-[-1.2px] text-ink tabular-nums">
            {year ?? '—'}
          </h2>
          <p className="mt-2 text-[12.5px] text-ink-tertiary">{t('wrapped.subtitle')}</p>
          {years.length > 1 && (
            <div className="absolute right-4 bottom-1 flex items-center gap-0.5">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={year === y}
                  onClick={() => setYear(y)}
                  className={[
                    'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors',
                    year === y
                      ? 'bg-surface-3 text-ink'
                      : 'text-ink-subtle hover:bg-surface-2 hover:text-ink-muted',
                  ].join(' ')}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {!stats || stats.activeDays === 0 ? (
          <p className="px-6 py-14 text-center text-[13px] text-ink-tertiary">
            {t('wrapped.empty')}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6">
            <div className="flex divide-x divide-hairline">
              <Stat label={t('stats.totalPr')} value={stats.pr} />
              <Stat label={t('stats.totalCommit')} value={stats.commit} />
              <Stat label={t('stats.activeDays')} value={stats.activeDays} />
              <Stat label={t('stats.streak')} value={stats.longestStreak} />
            </div>

            <Section title={t('wrapped.byMonth')}>
              <div className="flex h-[92px] items-end gap-[6px]">
                {stats.byMonth.map((m, i) => {
                  const total = m.pr + m.commit;
                  const isMax = total === monthMax && total > 0;
                  return (
                    <div
                      key={i}
                      className="group relative flex flex-1 flex-col items-center gap-1.5"
                    >
                      {isMax && (
                        <span className="absolute -top-4 font-mono text-[10px] text-ink">
                          {total.toLocaleString()}
                        </span>
                      )}
                      <div
                        className={`w-full max-w-[26px] rounded-[3px] transition-colors ${
                          isMax
                            ? 'bg-accent'
                            : total > 0
                              ? 'bg-hairline-strong group-hover:bg-hairline-tertiary'
                              : 'bg-surface-3'
                        }`}
                        style={{
                          height: `${Math.max(total > 0 ? 4 : 2, (total / monthMax) * 68)}px`,
                        }}
                        title={`${stats.year}-${String(i + 1).padStart(2, '0')} · ${total.toLocaleString()}`}
                      />
                      <span className="font-mono text-[10px] text-ink-tertiary tabular-nums">
                        {i + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={t('wrapped.top')}>
              {projects === null ? (
                <div className="flex items-center gap-2 py-2 text-[12px] text-ink-tertiary">
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                  {t('achv.scanning')}
                  {scan && ` ${scan.done}/${scan.total}`}
                </div>
              ) : projects.length === 0 ? (
                <p className="py-2 text-[12px] text-ink-tertiary">{t('wrapped.topEmpty')}</p>
              ) : (
                <div className="-mx-2">
                  {projects.map((p, i) => (
                    <div
                      key={p.name}
                      className="flex h-9 items-center gap-2.5 rounded-md px-2 transition-[background-color] hover:bg-surface-2"
                    >
                      <span
                        style={{ background: LANE_COLORS[i % LANE_COLORS.length] }}
                        className="size-1.5 shrink-0 rounded-full"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {p.name}
                      </span>
                      <span className="shrink-0 font-mono text-[11.5px] text-ink-tertiary tabular-nums">
                        {p.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={t('stats.weekday')}>
              <div className="flex h-[64px] items-end gap-[10px]">
                {stats.byWeekday.map((v, i) => {
                  const isMax = v === dowMax && v > 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <div
                        className={`w-full max-w-[34px] rounded-[3px] ${
                          isMax ? 'bg-accent' : v > 0 ? 'bg-accent/35' : 'bg-surface-3'
                        }`}
                        style={{ height: `${Math.max(v > 0 ? 4 : 2, (v / dowMax) * 44)}px` }}
                        title={v.toLocaleString()}
                      />
                      <span className="font-mono text-[10px] text-ink-tertiary">
                        {t(DOW_KEYS[i]!)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {stats.busiestDay && (
              <p className="mt-6 text-[12px] text-ink-tertiary">
                {t('stats.busiestDay')} ·{' '}
                <span className="font-mono text-ink">{stats.busiestDay.date}</span>{' '}
                <span className="font-mono">({stats.busiestDay.total.toLocaleString()})</span>
              </p>
            )}
          </div>
        )}

        {stats && stats.activeDays > 0 && (
          <div className="flex items-center justify-end gap-3 border-t border-hairline px-6 py-3">
            {save === 'error' && (
              <span className="text-[12px] text-danger">{t('wrapped.saveFail')}</span>
            )}
            <button
              type="button"
              disabled={save === 'saving'}
              onClick={() => void savePng()}
              className={`flex h-8 items-center gap-1.5 rounded-md px-4 text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-60 ${
                save === 'saved'
                  ? 'bg-surface-2 text-success'
                  : 'bg-surface-2 text-ink hover:bg-surface-3'
              }`}
            >
              {save === 'saved' ? (
                <Check size={14} strokeWidth={2.5} />
              ) : save === 'saving' ? (
                <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              ) : (
                <Download size={14} strokeWidth={2} />
              )}
              {save === 'saved' ? t('achv.saved') : t('wrapped.savePng')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col gap-1.5 px-5 first:pl-0 last:pr-0">
      <span className="text-[11.5px] text-ink-tertiary">{label}</span>
      <span className="text-[28px] leading-none font-semibold tracking-[-0.5px] text-ink tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <p className="mb-3 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

type CardLabels = { title: string; pr: string; commit: string; activeDays: string; streak: string };

// 공유 카드 — 화이트리스트 수치(연도·PR·커밋·활동일·스트릭)만, 프로젝트명 등 텍스트 비포함. 테마 무관 고정 다크
function drawShareCard(stats: WrappedStats, labels: CardLabels): string {
  const W = 840;
  const H = 440;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  ctx.fillStyle = '#0e0f14';
  ctx.fillRect(0, 0, W, H);

  const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  ctx.fillStyle = '#5b61e6';
  ctx.font = `600 14px ${sans}`;
  ctx.fillText('cairn', 56, 62);
  ctx.fillStyle = '#eceef6';
  ctx.font = `700 38px ${sans}`;
  ctx.fillText(`${stats.year} ${labels.title}`, 56, 106);

  const tiles: [string, number][] = [
    [labels.pr, stats.pr],
    [labels.commit, stats.commit],
    [labels.activeDays, stats.activeDays],
    [labels.streak, stats.longestStreak],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 56 + i * 185;
    ctx.fillStyle = '#8a90a6';
    ctx.font = `500 13px ${sans}`;
    ctx.fillText(label, x, 168);
    ctx.fillStyle = '#eceef6';
    ctx.font = `600 36px ${mono}`;
    ctx.fillText(value.toLocaleString(), x, 206);
  });

  const max = Math.max(1, ...stats.byMonth.map((m) => m.pr + m.commit));
  stats.byMonth.forEach((m, i) => {
    const total = m.pr + m.commit;
    const h = Math.max(total > 0 ? 5 : 2, (total / max) * 84);
    ctx.fillStyle = total === max && total > 0 ? '#5b61e6' : total > 0 ? '#3a3e6e' : '#22242e';
    ctx.fillRect(56 + i * 36, 340 - h, 24, h);
  });
  ctx.fillStyle = '#6b7086';
  ctx.font = `500 11px ${mono}`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 12; i++) ctx.fillText(String(i + 1), 68 + i * 36, 360);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}
