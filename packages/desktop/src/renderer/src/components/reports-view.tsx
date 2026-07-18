import { ArrowLeft, Check, Copy, FileDown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import type { I18nKey } from '../i18n';
import {
  buildLanes,
  dayIndex,
  daySpan,
  localDateDaysAgo,
  parseDoneBullet,
  timelineTicks,
  todayLocal,
  type DoneItem,
  type Lane,
} from '../lib/reports';
import { cachedScan, dailyTargets, startScan, type PerDay } from '../lib/reports-scan';
import { useSettings } from '../settings-context';
import { DateRangePicker } from './date-picker';

type RangeKey = 7 | 30 | 90 | 365 | 'custom';

const RANGE_PILLS: { key: RangeKey; labelKey: I18nKey }[] = [
  { key: 7, labelKey: 'reports.range.week' },
  { key: 30, labelKey: 'reports.range.month' },
  { key: 90, labelKey: 'reports.range.quarter' },
  { key: 365, labelKey: 'reports.range.year' },
  { key: 'custom', labelKey: 'achv.range.custom' },
];

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const laneKey = (repo: string | null): string => repo ?? '__none';

export function ReportsView({ recent }: { recent: RecentListResult | null }) {
  const { t, settings } = useSettings();
  const [range, setRange] = useState<RangeKey>(30);
  const [customFrom, setCustomFrom] = useState<string>(() => localDateDaysAgo(30));
  const [customTo, setCustomTo] = useState<string>(todayLocal);
  const since = range === 'custom' ? customFrom : localDateDaysAgo(range);
  const until = range === 'custom' ? customTo : todayLocal();

  const pages = useMemo(() => recent?.pages ?? [], [recent]);
  const targets = useMemo(() => dailyTargets(pages, since, until), [pages, since, until]);

  const [perDay, setPerDay] = useState<PerDay[] | null>(null);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);

  // 모듈 레벨 캐시(reports-scan) — 뷰 재진입 시 즉시 렌더, 일지 수가 달라졌으면 이전 결과를
  // 보여둔 채 뒤에서 재스캔 (stale-while-revalidate). 스피너는 캐시가 전혀 없을 때만
  useEffect(() => {
    const entry = cachedScan(since, until);
    if (entry) {
      setPerDay(entry.rows);
      setScan(null);
      if (entry.count === targets.length) return;
    }
    if (targets.length === 0) {
      setPerDay([]);
      setScan(null);
      return;
    }
    let alive = true;
    if (!entry) {
      setPerDay(null);
      setScan({ done: 0, total: targets.length });
    }
    void startScan(since, until, targets, (done, total) => {
      if (alive && !entry) setScan({ done, total });
    }).then((rows) => {
      if (!alive) return;
      setPerDay(rows);
      setScan(null);
    });
    return () => {
      alive = false;
    };
  }, [since, until, targets]);

  const items = useMemo(
    () => (perDay ?? []).flatMap((d) => d.bullets.map((b) => parseDoneBullet(d.date, b))),
    [perDay],
  );
  const lanes = useMemo(() => buildLanes(items), [items]);
  const itemsByLane = useMemo(() => {
    const map = new Map<string, DoneItem[]>();
    for (const it of items) {
      const key = laneKey(it.repo);
      const bucket = map.get(key);
      if (bucket) bucket.push(it);
      else map.set(key, [it]);
    }
    for (const bucket of map.values()) bucket.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [items]);

  const stats = useMemo(
    () => ({
      worklogs: targets.length,
      done: items.length,
      pr: targets.reduce((n, p) => n + (p.pr ?? 0), 0),
      commit: targets.reduce((n, p) => n + (p.commit ?? 0), 0),
    }),
    [targets, items],
  );

  // 기존 다이얼로그의 md 포맷 그대로 — 헤더 + 월별 섹션 (Done 없어도 수치 헤더는 유지)
  const markdown = useMemo(() => {
    if (!perDay) return null;
    const byMonth = new Map<string, string[]>();
    for (const d of perDay) {
      if (d.bullets.length === 0) continue;
      const bucket = byMonth.get(d.date.slice(0, 7)) ?? [];
      bucket.push(...d.bullets);
      byMonth.set(d.date.slice(0, 7), bucket);
    }
    const months = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));
    const body = months
      .map(
        (m) =>
          `## ${m}\n\n${byMonth
            .get(m)!
            .map((b) => `- ${b}`)
            .join('\n')}`,
      )
      .join('\n\n');
    const header = `# ${since} ~ ${until}\n\n${t('achv.mdHeader')
      .replace('{n}', String(stats.worklogs))
      .replace('{pr}', String(stats.pr))
      .replace('{commit}', String(stats.commit))}`;
    return body ? `${header}\n\n${body}` : header;
  }, [perDay, since, until, stats, t]);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const filename =
    range === 'custom' ? `worklog-${since}-${until}.md` : `worklog-last-${range}d.md`;

  function copyMd() {
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

  // 상세 진입 상태 — 기간 필터가 바뀌어도 유지, 데이터(itemsByLane)만 새 기간 기준으로 갱신
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRepo === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]')) return;
      setSelectedRepo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRepo]);

  const laneLabel = (repo: string | null): string => repo ?? t('reports.noRepo');
  const scanning = scan !== null && perDay === null;
  const ready = perDay !== null;

  const detailRows = selectedRepo !== null ? (itemsByLane.get(selectedRepo) ?? []) : [];
  const detailDays = new Set(detailRows.map((r) => r.date)).size;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <header className="shrink-0 pb-4">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-6">
          <div className="flex shrink-0 items-center gap-0.5">
            {RANGE_PILLS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setRange(p.key)}
                className={[
                  'rounded-md px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors',
                  range === p.key
                    ? 'bg-surface-3 text-ink'
                    : 'text-ink-subtle hover:bg-surface-2 hover:text-ink-muted',
                ].join(' ')}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          {range === 'custom' && (
            <DateRangePicker
              value={{ from: customFrom, to: customTo }}
              max={todayLocal()}
              onChange={(r) => {
                setCustomFrom(r.from);
                setCustomTo(r.to);
              }}
            />
          )}
          <span className="shrink-0 text-[12px] text-ink-tertiary">
            {targets.length}
            {t('achv.worklogs')}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={copyMd}
              disabled={!markdown}
              title={t('achv.copy')}
              aria-label={t('achv.copy')}
              className={`flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
                copied ? 'text-success' : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
            </button>
            <button
              type="button"
              onClick={saveMd}
              disabled={!markdown}
              title={t('achv.save')}
              aria-label={t('achv.save')}
              className={`flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
                saved ? 'text-success' : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {saved ? (
                <Check size={14} strokeWidth={2.5} />
              ) : (
                <FileDown size={14} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div key={`${since}:${until}`} className="panel-enter mx-auto w-full max-w-5xl px-6 pb-8">
          {!recent ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-ink-tertiary">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              {t('list.loading')}
            </div>
          ) : scanning ? (
            <ScanRing done={scan?.done ?? 0} total={scan?.total ?? 0} label={t('achv.scanning')} />
          ) : ready && selectedRepo !== null ? (
            <div key={selectedRepo} className="panel-enter flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRepo(null)}
                  title={t('reports.back')}
                  aria-label={t('reports.back')}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <ArrowLeft size={15} strokeWidth={2} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold tracking-[-0.2px] text-ink">
                    {laneLabel(selectedRepo === '__none' ? null : selectedRepo)}
                  </h2>
                  <p className="mt-0.5 font-mono text-[11.5px] text-ink-tertiary tabular-nums">
                    {t('reports.detail.stats')
                      .replace('{n}', String(detailRows.length))
                      .replace('{d}', String(detailDays))}
                  </p>
                </div>
              </div>
              {detailRows.length === 0 ? (
                <div className="py-16 text-center text-[12px] text-ink-tertiary">
                  {t('achv.empty')}
                </div>
              ) : (
                <div>
                  {detailRows.map((it, i) => (
                    <div
                      key={i}
                      className="flex min-h-9 items-center gap-3 rounded-md px-2 py-1.5 transition-[background-color] hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-muted">
                        {it.text}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-tertiary tabular-nums">
                        {it.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : ready && items.length === 0 ? (
            <div className="rounded-lg border border-hairline py-16 text-center text-[12px] text-ink-tertiary">
              {t('achv.empty')}
            </div>
          ) : ready ? (
            <div className="flex flex-col gap-7">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11.5px] text-ink-tertiary tabular-nums">
                <span>
                  {t('achv.mdHeader')
                    .replace('{n}', String(stats.worklogs))
                    .replace('{pr}', String(stats.pr))
                    .replace('{commit}', String(stats.commit))}
                </span>
                <span>
                  · {stats.done} {t('achv.done')}
                </span>
              </div>

              <div>
                <p className="mb-2 px-1 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
                  {t('reports.timeline')}
                </p>
                <Timeline
                  since={since}
                  until={until}
                  lanes={lanes}
                  lang={settings.language}
                  laneLabel={laneLabel}
                  onLaneClick={(lane) => setSelectedRepo(laneKey(lane.repo))}
                />
              </div>

              <div>
                <p className="mb-1 px-1 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
                  {t('reports.byRepo')}
                </p>
                <div className="mb-1 flex items-center gap-3 border-b border-hairline px-2 pb-1.5 text-[10.5px] font-medium tracking-wider text-ink-tertiary uppercase">
                  <span className="min-w-0 flex-1">{t('reports.repoCol')}</span>
                  <span className="w-10 shrink-0 text-right">{t('reports.itemsCol')}</span>
                  <span className="w-24 shrink-0 text-right">{t('reports.activityCol')}</span>
                </div>
                <div>
                  {lanes.map((lane) => (
                    <button
                      key={laneKey(lane.repo)}
                      type="button"
                      onClick={() => setSelectedRepo(laneKey(lane.repo))}
                      className="flex h-10 w-full items-center gap-3 rounded-md px-2 text-left transition-[background-color] hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                        {laneLabel(lane.repo)}
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-tertiary tabular-nums">
                        {lane.count}
                      </span>
                      <ActivitySpark since={since} until={until} dates={lane.dates} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// 레포 헤더 행 우측의 기간 활동 미니 표시 — Timeline 도트 문법의 축소판
function ActivitySpark({ since, until, dates }: { since: string; until: string; dates: string[] }) {
  const span = daySpan(since, until);
  return (
    <span className="relative h-4 w-24 shrink-0" aria-hidden="true">
      {dates.map((d) => (
        <span
          key={d}
          style={{ left: `${((dayIndex(since, d) + 0.5) / span) * 100}%` }}
          className="absolute top-1/2 size-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-subtle"
        />
      ))}
    </span>
  );
}

function ScanRing({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const offset = RING_C * (1 - (total > 0 ? done / total : 0));
  return (
    <div className="flex flex-col items-center py-14">
      <svg width="72" height="72" viewBox="0 0 64 64" className="block">
        <circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="5"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          transform="rotate(-90 32 32)"
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
        <text
          x="32"
          y="32"
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono font-semibold tabular-nums"
          fontSize="13"
          fill="var(--color-ink)"
        >
          {pct}%
        </text>
      </svg>
      <p className="mt-3.5 text-[13px] font-medium text-ink">{label}</p>
      <p className="mt-1 font-mono text-[11.5px] text-ink-tertiary tabular-nums">
        {done} / {total}
      </p>
    </div>
  );
}

function Timeline({
  since,
  until,
  lanes,
  lang,
  laneLabel,
  onLaneClick,
}: {
  since: string;
  until: string;
  lanes: Lane[];
  lang: string;
  laneLabel: (repo: string | null) => string;
  onLaneClick: (lane: Lane) => void;
}) {
  const span = daySpan(since, until);
  const { unit, ticks } = timelineTicks(since, until);
  const tickLabel = (date: string): string => {
    if (unit === 'week') return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
    const m = Number(date.slice(5, 7));
    return lang === 'ko'
      ? `${m}월`
      : new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  };

  return (
    <div className="relative">
      {/* 세로 점선 hairline — 축 라벨 아래부터 섹션 전체 높이 관통 (풀블리드, 박스 없음) */}
      <div className="pointer-events-none absolute inset-x-0 top-6 bottom-0">
        {ticks.map((tk) => (
          <span
            key={tk.date}
            style={{ left: `${tk.pos * 100}%` }}
            className="absolute inset-y-0 border-l border-dashed border-hairline"
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="relative h-6">
        {ticks.map((tk) => (
          <span
            key={tk.date}
            style={{ left: `${tk.pos * 100}%` }}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-tertiary"
          >
            {tickLabel(tk.date)}
          </span>
        ))}
      </div>

      <div className="relative">
        {lanes.map((lane) => {
          const first = lane.dates[0]!;
          const last = lane.dates[lane.dates.length - 1]!;
          const width = Math.max((daySpan(first, last) / span) * 100, 3);
          const left = Math.min((dayIndex(since, first) / span) * 100, 100 - width);
          // 우측 끝 레인은 라벨을 바 오른쪽 끝에 맞춰 오버플로 방지
          const alignEnd = left + width > 82;
          return (
            <button
              key={laneKey(lane.repo)}
              type="button"
              onClick={() => onLaneClick(lane)}
              title={`${laneLabel(lane.repo)} · ${lane.count}`}
              className="group relative block h-[52px] w-full rounded-md text-left transition-[background-color] hover:bg-surface-2/40"
            >
              <span
                style={alignEnd ? { right: `${100 - left - width}%` } : { left: `${left}%` }}
                className="absolute top-0 flex max-w-full items-baseline gap-1.5 whitespace-nowrap"
              >
                <span className="truncate text-[13px] font-medium text-ink-muted transition-colors group-hover:text-ink">
                  {laneLabel(lane.repo)}
                </span>
                <span className="font-mono text-[10.5px] text-ink-tertiary tabular-nums">
                  {lane.count}
                </span>
              </span>
              <span
                style={{ left: `${left}%`, width: `${width}%` }}
                className="absolute bottom-1 h-7 rounded-lg bg-surface-3"
              />
              {lane.dates.map((d) => (
                <span
                  key={d}
                  style={{ left: `${((dayIndex(since, d) + 0.5) / span) * 100}%` }}
                  className="absolute bottom-[18px] size-[5px] -translate-x-1/2 translate-y-1/2 rounded-full bg-ink-subtle"
                />
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
