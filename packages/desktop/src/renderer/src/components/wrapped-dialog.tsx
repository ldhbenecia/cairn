import { motion } from 'framer-motion';
import {
  Check,
  Download,
  Flame,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult, RecentPage } from '../cairn-api';
import { pool, sectionBullets } from '../lib/blocks';
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
  const [saved, setSaved] = useState(false);
  const projectCache = useRef(new Map<string, Project[]>());

  const stats = useMemo(() => (year ? computeWrapped(pages, year) : null), [pages, year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!year) return;
    const cached = projectCache.current.get(year);
    if (cached) {
      setProjects(cached);
      return;
    }
    let alive = true;
    setProjects(null);
    const targets = pages.filter((p) => p.category === 'daily' && p.date?.startsWith(`${year}-`));
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
      projectCache.current.set(year, top);
      setProjects(top);
      setScan(null);
    })();
    return () => {
      alive = false;
    };
  }, [year, pages]);

  async function savePng() {
    if (!stats) return;
    const dataUrl = drawShareCard(stats, projects ?? []);
    const r = await window.cairn.exportPng(`cairn-wrapped-${stats.year}.png`, dataUrl);
    if (r.saved) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  const monthMax = stats ? Math.max(1, ...stats.byMonth.map((m) => m.pr + m.commit)) : 1;
  const dowMax = stats ? Math.max(1, ...stats.byWeekday) : 1;
  const DOW: (
    | 'stats.dow.sun'
    | 'stats.dow.mon'
    | 'stats.dow.tue'
    | 'stats.dow.wed'
    | 'stats.dow.thu'
    | 'stats.dow.fri'
    | 'stats.dow.sat'
  )[] = [
    'stats.dow.sun',
    'stats.dow.mon',
    'stats.dow.tue',
    'stats.dow.wed',
    'stats.dow.thu',
    'stats.dow.fri',
    'stats.dow.sat',
  ];

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
        className="glass-panel flex max-h-[82vh] w-[600px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles size={15} strokeWidth={2} className="text-accent-hover" />
            <p className="text-[14px] font-semibold text-ink">{t('wrapped.title')}</p>
            <div className="ml-2 flex gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={[
                    'rounded-md border px-2 py-0.5 font-mono text-[11.5px] transition-colors',
                    year === y
                      ? 'border-accent/50 bg-accent/15 text-ink'
                      : 'border-hairline text-ink-muted hover:bg-surface-2 hover:text-ink',
                  ].join(' ')}
                >
                  {y}
                </button>
              ))}
            </div>
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

        {!stats || stats.activeDays === 0 ? (
          <p className="px-5 py-14 text-center text-[13px] text-ink-tertiary">
            {t('wrapped.empty')}
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-4 gap-2">
              <Tile
                icon={<GitPullRequest size={13} strokeWidth={2} />}
                label={t('stats.totalPr')}
                value={stats.pr}
              />
              <Tile
                icon={<GitCommitHorizontal size={13} strokeWidth={2} />}
                label={t('stats.totalCommit')}
                value={stats.commit}
              />
              <Tile label={t('stats.activeDays')} value={stats.activeDays} />
              <Tile
                icon={<Flame size={13} strokeWidth={2} />}
                label={t('stats.streak')}
                value={stats.longestStreak}
              />
            </div>

            <Section title={t('wrapped.byMonth')}>
              <div className="flex h-20 items-end gap-1">
                {stats.byMonth.map((m, i) => {
                  const total = m.pr + m.commit;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-accent/70"
                        style={{
                          height: `${Math.max(total > 0 ? 6 : 2, (total / monthMax) * 64)}px`,
                        }}
                        title={`${i + 1}: ${total}`}
                      />
                      <span className="text-[9.5px] text-ink-tertiary">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={t('stats.weekday')}>
              <div className="flex items-end gap-1.5">
                {stats.byWeekday.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-chart-companion/80"
                      style={{ height: `${Math.max(v > 0 ? 5 : 2, (v / dowMax) * 40)}px` }}
                      title={`${v}`}
                    />
                    <span className="text-[9.5px] text-ink-tertiary">{t(DOW[i]!)}</span>
                  </div>
                ))}
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
                <div className="flex flex-col gap-1.5">
                  {projects.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-4 text-right font-mono text-ink-tertiary">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-ink">{p.name}</span>
                      <span className="font-mono text-[11.5px] text-ink-tertiary">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {stats.busiestDay && (
              <p className="mt-4 text-[11.5px] text-ink-tertiary">
                {t('stats.busiestDay')}: <span className="font-mono">{stats.busiestDay.date}</span>{' '}
                · {stats.busiestDay.total}
              </p>
            )}
          </div>
        )}

        {stats && stats.activeDays > 0 && (
          <div className="flex justify-end border-t border-hairline px-5 py-3.5">
            <button
              type="button"
              onClick={() => void savePng()}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                saved
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-hairline bg-surface-2 text-ink hover:bg-surface-3'
              }`}
            >
              {saved ? (
                <Check size={14} strokeWidth={2.5} />
              ) : (
                <Download size={14} strokeWidth={2} />
              )}
              {saved ? t('achv.saved') : t('wrapped.savePng')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Tile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-2/50 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[10.5px] text-ink-tertiary">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[20px] leading-none font-semibold text-ink">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

// 공유 카드 — 화이트리스트 수치(연도·PR·커밋·활동일·스트릭·repo basename)만. 테마 무관 고정 다크
function drawShareCard(stats: WrappedStats, projects: Project[]): string {
  const W = 840;
  const H = 440;
  const canvas = document.createElement('canvas');
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  ctx.fillStyle = '#0e0f14';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#5b61e6';
  ctx.fillRect(0, 0, W, 4);

  const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#9aa0b4';
  ctx.font = `500 15px ${mono}`;
  ctx.fillText('cairn', 48, 64);
  ctx.fillStyle = '#eceef6';
  ctx.font = `700 34px ${mono}`;
  ctx.fillText(`Wrapped ${stats.year}`, 48, 104);

  const tiles: [string, number][] = [
    ['PR', stats.pr],
    ['Commits', stats.commit],
    ['Active days', stats.activeDays],
    ['Longest streak', stats.longestStreak],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 48 + i * 190;
    ctx.fillStyle = '#9aa0b4';
    ctx.font = `500 13px ${mono}`;
    ctx.fillText(label, x, 172);
    ctx.fillStyle = '#eceef6';
    ctx.font = `700 40px ${mono}`;
    ctx.fillText(value.toLocaleString(), x, 216);
  });

  const max = Math.max(1, ...stats.byMonth.map((m) => m.pr + m.commit));
  stats.byMonth.forEach((m, i) => {
    const total = m.pr + m.commit;
    const h = Math.max(total > 0 ? 6 : 2, (total / max) * 70);
    ctx.fillStyle = total > 0 ? '#5b61e6' : '#2a2c38';
    ctx.fillRect(48 + i * 34, 330 - h, 22, h);
  });

  ctx.fillStyle = '#9aa0b4';
  ctx.font = `500 13px ${mono}`;
  projects.slice(0, 3).forEach((p, i) => {
    ctx.fillText(`${i + 1}. ${p.name}`, 490, 268 + i * 24);
  });
  if (projects.length > 0) {
    ctx.fillStyle = '#6b7086';
    ctx.fillText('Top projects', 490, 240);
  }

  ctx.fillStyle = '#6b7086';
  ctx.font = `500 12px ${mono}`;
  ctx.fillText(`Jan — Dec · ${stats.year}`, 48, 366);

  return canvas.toDataURL('image/png');
}
