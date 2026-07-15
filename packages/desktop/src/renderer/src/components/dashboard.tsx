import {
  Sparkles,
  Activity,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Clock,
  Flame,
  GitCommitHorizontal,
  GitPullRequest,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult, RecentPage } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';

type T = (key: I18nKey) => string;

type DayActivity = { date: string; pr: number; commit: number; total: number };
type MonthBucket = { month: string; pr: number; commit: number; activeDays: number };

type Agg = {
  byDate: Map<string, DayActivity>;
  months: MonthBucket[];
  weekday: number[];
  hours: number[];
  total: { pr: number; commit: number; activeDays: number };
  streak: { current: number; longest: number };
};

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function aggregate(pages: RecentPage[]): Agg {
  const byDate = new Map<string, DayActivity>();
  const byMonth = new Map<string, { pr: number; commit: number; days: Set<string> }>();
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const hours = new Array<number>(24).fill(0);

  for (const p of pages) {
    if (p.category !== 'daily' || !p.date) continue;
    const pr = p.pr ?? 0;
    const commit = p.commit ?? 0;
    const hrs = p.hours;
    if (hrs && hrs.length === 24) for (let i = 0; i < 24; i++) hours[i]! += hrs[i]!;
    const total = pr + commit;
    const prev = byDate.get(p.date);
    byDate.set(p.date, {
      date: p.date,
      pr: (prev?.pr ?? 0) + pr,
      commit: (prev?.commit ?? 0) + commit,
      total: (prev?.total ?? 0) + total,
    });
    const month = p.date.slice(0, 7);
    const mb = byMonth.get(month) ?? { pr: 0, commit: 0, days: new Set<string>() };
    mb.pr += pr;
    mb.commit += commit;
    if (total > 0) mb.days.add(p.date);
    byMonth.set(month, mb);
    if (total > 0) {
      // 로컬 자정 기준 요일 — date 는 사용자 로컬 날짜이므로 T00:00 로 파싱
      const wd = new Date(`${p.date}T00:00:00`).getDay();
      weekday[wd]! += total;
    }
  }

  const months = [...byMonth.entries()]
    .map(([month, b]) => ({ month, pr: b.pr, commit: b.commit, activeDays: b.days.size }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const total = [...byDate.values()].reduce(
    (acc, d) => ({
      pr: acc.pr + d.pr,
      commit: acc.commit + d.commit,
      activeDays: acc.activeDays + (d.total > 0 ? 1 : 0),
    }),
    { pr: 0, commit: 0, activeDays: 0 },
  );

  return { byDate, months, weekday, hours, total, streak: computeStreak(byDate) };
}

function computeStreak(byDate: Map<string, DayActivity>): { current: number; longest: number } {
  const active = new Set([...byDate.values()].filter((d) => d.total > 0).map((d) => d.date));
  if (active.size === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let run = 0;
  const sorted = [...active].sort();
  let prev: Date | null = null;
  for (const ds of sorted) {
    const d = new Date(`${ds}T00:00:00`);
    // Math.round — DST 전환일은 로컬 자정 간격이 23/25h 라 정수 나눗셈만으론 1 이 안 됨
    if (prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!active.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (active.has(isoDay(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}

const HUE = {
  teal: '#14b8a6',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  sky: '#0ea5e9',
} as const;

type CumPoint = { date: string; value: number };

function cumulativeSeries(byDate: Map<string, DayActivity>): CumPoint[] | null {
  const active = [...byDate.values()].filter((d) => d.total > 0).map((d) => d.date);
  if (active.length === 0) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = new Date(`${active.sort()[0]}T00:00:00`);
  let start = new Date(today);
  start.setDate(start.getDate() - 119);
  if (first > start) start = first;
  const startKey = isoDay(start);

  let cum = 0;
  for (const d of byDate.values()) if (d.date < startKey) cum += d.total;

  const series: CumPoint[] = [];
  const cur = new Date(start);
  while (cur <= today) {
    cum += byDate.get(isoDay(cur))?.total ?? 0;
    series.push({ date: isoDay(cur), value: cum });
    cur.setDate(cur.getDate() + 1);
  }
  return series;
}

type Insights = {
  busiest: DayActivity | null;
  dailyAvg: number;
  thisWeek: number;
  weekDelta: number | null;
  thisMonth: number;
  monthDelta: number | null;
  peak: { key: I18nKey; count: number } | null;
};

function computeInsights(data: Agg): Insights {
  let busiest: DayActivity | null = null;
  for (const d of data.byDate.values()) {
    if (d.total > 0 && (!busiest || d.total > busiest.total)) busiest = d;
  }

  const totalAll = data.total.pr + data.total.commit;
  const dailyAvg = data.total.activeDays > 0 ? totalAll / data.total.activeDays : 0;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const curKey = isoDay(now).slice(0, 7);
  const prevKey = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const monthTotal = (key: string): number => {
    const m = data.months.find((b) => b.month === key);
    return m ? m.pr + m.commit : 0;
  };
  const thisMonth = monthTotal(curKey);
  const lastMonth = monthTotal(prevKey);
  const monthDelta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  // 주간 리듬 — 이번 주(월요일 시작, 로컬 TZ)와 직전 주 비교. 월간 카드와 동일하게 부분 주 vs 온전한 주
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sumRange = (from: Date, days: number): number => {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      sum += data.byDate.get(isoDay(d))?.total ?? 0;
    }
    return sum;
  };
  const thisWeek = sumRange(monday, 7);
  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const lastWeek = sumRange(prevMonday, 7);
  const weekDelta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  let peak: { key: I18nKey; count: number } | null = null;
  if (data.hours.some((h) => h > 0)) {
    for (const p of TOD_PERIODS) {
      let sum = 0;
      for (let h = p.from; h <= p.to; h++) sum += data.hours[h] ?? 0;
      if (!peak || sum > peak.count) peak = { key: p.key, count: sum };
    }
  }

  return { busiest, dailyAvg, thisWeek, weekDelta, thisMonth, monthDelta, peak };
}

const HEATMAP_WEEKS = 53;
const CELL = 12;
const CELL_GAP = 3;

function Reveal({
  children,
  className,
  root,
  threshold = 0.3,
}: {
  children: ReactNode;
  className?: string;
  root: RefObject<HTMLElement | null>;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { root: root.current, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, shown, threshold]);
  return (
    <div
      ref={ref}
      className={`reveal${shown ? ' reveal-in' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}

export function Dashboard({
  recent,
  onPickDate,
  onGoToWorklogs,
  onOpenWrapped,
}: {
  recent: RecentListResult | null;
  onPickDate?: (date: string) => void;
  onGoToWorklogs?: () => void;
  onOpenWrapped?: () => void;
}) {
  const { t } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const data = useMemo(() => aggregate(recent?.pages ?? []), [recent]);
  const insights = useMemo(() => computeInsights(data), [data]);
  const cumulative = useMemo(() => cumulativeSeries(data.byDate), [data]);
  const recentMonths = data.months.slice(-12);

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <div ref={scrollRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-5xl px-6 pb-10">
          <div className="flex items-start justify-between pb-1">
            <h1 className="text-[20px] font-semibold tracking-[-0.3px] text-ink">
              {t('stats.title')}
            </h1>
            {onOpenWrapped && (
              <button
                type="button"
                onClick={onOpenWrapped}
                className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-1 px-2.5 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Sparkles size={13} strokeWidth={2} className="text-accent-hover" />
                Wrapped
              </button>
            )}
          </div>
          <p className="pb-6 text-[13px] text-ink-tertiary">{t('stats.subtitle')}</p>

          {!recent ? (
            <p className="py-16 text-center text-[12px] text-ink-tertiary">{t('list.loading')}</p>
          ) : data.byDate.size === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-hairline bg-surface-1 py-16 text-center">
              <p className="text-[12px] text-ink-tertiary">{t('stats.empty')}</p>
              {onGoToWorklogs && (
                <button
                  type="button"
                  onClick={onGoToWorklogs}
                  className="rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  {t('stats.emptyCta')}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <Reveal className="dash-rise grid grid-cols-2 gap-3 sm:grid-cols-4" root={scrollRef}>
                <StatCard
                  icon={<GitPullRequest size={15} strokeWidth={2} />}
                  label={t('stats.totalPr')}
                  value={data.total.pr}
                />
                <StatCard
                  icon={<GitCommitHorizontal size={15} strokeWidth={2} />}
                  label={t('stats.totalCommit')}
                  value={data.total.commit}
                />
                <StatCard
                  icon={<CalendarCheck size={15} strokeWidth={2} />}
                  label={t('stats.activeDays')}
                  value={data.total.activeDays}
                />
                <StatCard
                  icon={<Flame size={15} strokeWidth={2} />}
                  label={t('stats.streak')}
                  value={data.streak.current}
                  hint={`${t('stats.streakLongest')} ${data.streak.longest}`}
                />
              </Reveal>

              <Reveal className="dash-rise" root={scrollRef}>
                <InsightCards insights={insights} t={t} />
              </Reveal>

              {cumulative && cumulative.length > 1 && (
                <Reveal className="dash-rise" root={scrollRef}>
                  <CumulativeChart series={cumulative} t={t} />
                </Reveal>
              )}

              <Reveal className="dash-rise" root={scrollRef}>
                <Heatmap byDate={data.byDate} t={t} onPickDate={onPickDate} />
              </Reveal>

              <Reveal
                className="dash-rise grid grid-cols-1 gap-6 lg:grid-cols-3"
                root={scrollRef}
                threshold={0.45}
              >
                <div className="lg:col-span-2">
                  <MonthlyChart months={recentMonths} t={t} />
                </div>
                <WeekdayChart weekday={data.weekday} t={t} />
              </Reveal>

              {data.hours.some((h) => h > 0) && (
                <Reveal className="dash-rise" root={scrollRef}>
                  <TimeOfDayChart hours={data.hours} t={t} />
                </Reveal>
              )}

              <Reveal className="dash-rise text-[11px] text-ink-tertiary" root={scrollRef}>
                {t('stats.note')}
              </Reveal>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[24px] font-semibold tracking-[-0.5px] text-ink">
        {value}
      </span>
      {hint && <span className="text-[11px] text-ink-tertiary">{hint}</span>}
    </div>
  );
}

function InsightCards({ insights, t }: { insights: Insights; t: T }) {
  const { busiest, dailyAvg, thisWeek, weekDelta, thisMonth, monthDelta, peak } = insights;
  const suffix = t('stats.countSuffix');
  const up = monthDelta !== null && monthDelta >= 0;
  const deltaText =
    monthDelta === null
      ? t('stats.vsLastMonth')
      : `${up ? '+' : ''}${monthDelta}% · ${t('stats.vsLastMonth')}`;
  const weekUp = weekDelta !== null && weekDelta >= 0;
  const weekDeltaText =
    weekDelta === null
      ? t('stats.vsLastWeek')
      : `${weekUp ? '+' : ''}${weekDelta}% · ${t('stats.vsLastWeek')}`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {busiest && (
        <InsightCard
          hue={HUE.amber}
          icon={<Trophy size={14} strokeWidth={2} />}
          label={t('stats.busiestDay')}
          value={busiest.date.slice(5)}
          sub={`${busiest.total}${suffix}`}
        />
      )}
      <InsightCard
        hue={HUE.teal}
        icon={<Activity size={14} strokeWidth={2} />}
        label={t('stats.dailyAvg')}
        value={dailyAvg.toFixed(1)}
      />
      <InsightCard
        hue={HUE.sky}
        icon={<CalendarDays size={14} strokeWidth={2} />}
        label={t('stats.thisWeek')}
        value={`${thisWeek}${suffix}`}
        sub={weekDeltaText}
        subColor={
          weekDelta === null ? undefined : weekUp ? 'var(--color-success)' : 'var(--color-danger)'
        }
        subIcon={
          weekDelta === null ? null : weekUp ? (
            <TrendingUp size={11} strokeWidth={2.2} />
          ) : (
            <TrendingDown size={11} strokeWidth={2.2} />
          )
        }
      />
      <InsightCard
        hue={HUE.violet}
        icon={<CalendarRange size={14} strokeWidth={2} />}
        label={t('stats.thisMonth')}
        value={`${thisMonth}${suffix}`}
        sub={deltaText}
        subColor={
          monthDelta === null ? undefined : up ? 'var(--color-success)' : 'var(--color-danger)'
        }
        subIcon={
          monthDelta === null ? null : up ? (
            <TrendingUp size={11} strokeWidth={2.2} />
          ) : (
            <TrendingDown size={11} strokeWidth={2.2} />
          )
        }
      />
      {peak && (
        <InsightCard
          hue={HUE.rose}
          icon={<Clock size={14} strokeWidth={2} />}
          label={t('stats.peakTime')}
          value={t(peak.key)}
          sub={`${peak.count}${suffix}`}
        />
      )}
    </div>
  );
}

function InsightCard({
  hue,
  icon,
  label,
  value,
  sub,
  subColor,
  subIcon,
}: {
  hue: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  subIcon?: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg border px-4 py-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${hue} 28%, var(--color-hairline))`,
        background: `color-mix(in srgb, ${hue} 6%, var(--color-surface-1))`,
      }}
    >
      <span className="flex items-center gap-1.5 text-[12px]" style={{ color: hue }}>
        {icon}
        {label}
      </span>
      <span className="text-[18px] font-semibold tracking-[-0.3px] text-ink">{value}</span>
      {sub && (
        <span
          className="flex items-center gap-1 text-[11px]"
          style={{ color: subColor ?? 'var(--color-ink-tertiary)' }}
        >
          {subIcon}
          {sub}
        </span>
      )}
    </div>
  );
}

function CumulativeChart({ series, t }: { series: CumPoint[]; t: T }) {
  const W = 560;
  const H = 170;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 8;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;

  const n = series.length;
  const minV = series[0]!.value;
  const maxV = series[n - 1]!.value;
  const span = Math.max(1, maxV - minV);
  const x = (i: number): number => padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number): number => baseY - ((v - minV) / span) * plotH;

  const line = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `M${x(0).toFixed(1)},${baseY} ${series
    .map((p, i) => `L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ')} L${x(n - 1).toFixed(1)},${baseY} Z`;

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-ink-muted">{t('stats.cumulative')}</span>
        <span className="ml-auto font-mono text-[20px] font-semibold tracking-[-0.5px] text-accent">
          {maxV}
        </span>
      </div>
      <p className="mb-2 text-[11px] text-ink-tertiary">{t('stats.cumulativeHint')}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={t('stats.cumulative')}
      >
        <defs>
          <linearGradient id="cum-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.26} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path className="area-fade" d={area} fill="url(#cum-fill)" />
        <path
          className="line-draw"
          d={line}
          pathLength={1}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          className="area-fade"
          cx={x(n - 1)}
          cy={y(maxV)}
          r={3.5}
          fill="var(--color-accent)"
        />
      </svg>
    </div>
  );
}

function Heatmap({
  byDate,
  t,
  onPickDate,
}: {
  byDate: Map<string, DayActivity>;
  t: T;
  onPickDate?: (date: string) => void;
}) {
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));

    let max = 1;
    for (const d of byDate.values()) max = Math.max(max, d.total);

    const cols: { date: string; total: number; future: boolean }[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: { date: string; total: number; future: boolean }[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const ds = isoDay(cur);
        col.push({ date: ds, total: byDate.get(ds)?.total ?? 0, future: cur > today });
        cur.setDate(cur.getDate() + 1);
      }
      cols.push(col);
    }
    return { cols, max };
  }, [byDate]);

  const level = (total: number): number => {
    if (total <= 0) return 0;
    const r = total / weeks.max;
    if (r > 0.66) return 4;
    if (r > 0.33) return 3;
    if (r > 0.12) return 2;
    return 1;
  };
  const LEVEL_BG = [
    'var(--color-surface-2)',
    'color-mix(in srgb, var(--color-accent) 28%, transparent)',
    'color-mix(in srgb, var(--color-accent) 48%, transparent)',
    'color-mix(in srgb, var(--color-accent) 70%, transparent)',
    'var(--color-accent)',
  ];

  // 툴팁 좌표는 absolute(컨테이너 기준) — transform 가진 상위(.dash-rise) 때문에 fixed 면 위치가 틀어진다
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);

  return (
    <div ref={wrapRef} className="relative rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-ink-muted">{t('stats.heatmap')}</span>
        <span className="flex items-center gap-1 text-[11px] text-ink-tertiary">
          {t('stats.less')}
          {LEVEL_BG.map((bg, i) => (
            <span key={i} className="size-2.5 rounded-sm" style={{ background: bg }} />
          ))}
          {t('stats.more')}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5">
          <div className="flex shrink-0 flex-col" style={{ gap: CELL_GAP }}>
            {['', t('stats.dow.mon'), '', t('stats.dow.wed'), '', t('stats.dow.fri'), ''].map(
              (d, i) => (
                <span
                  key={i}
                  className="text-right text-[9px] text-ink-tertiary"
                  style={{ height: CELL, width: 16, lineHeight: `${CELL}px` }}
                >
                  {d}
                </span>
              ),
            )}
          </div>
          <div className="flex" style={{ gap: CELL_GAP }}>
            {weeks.cols.map((col, ci) => (
              <div key={ci} className="flex flex-col" style={{ gap: CELL_GAP }}>
                {col.map((cell) => {
                  const clickable = !cell.future && cell.total > 0 && !!onPickDate;
                  return (
                    <span
                      key={cell.date}
                      className={`rounded-[2px] transition-transform hover:scale-125 ${clickable ? 'cursor-pointer' : ''}`}
                      style={{
                        width: CELL,
                        height: CELL,
                        background: cell.future ? 'transparent' : LEVEL_BG[level(cell.total)],
                      }}
                      onClick={() => clickable && onPickDate?.(cell.date)}
                      onMouseEnter={(e) => {
                        if (cell.future) return;
                        const wrap = wrapRef.current;
                        if (!wrap) return;
                        const r = e.currentTarget.getBoundingClientRect();
                        const cr = wrap.getBoundingClientRect();
                        setTip({
                          label: `${cell.date} · ${cell.total}${t('stats.countSuffix')}`,
                          x: r.left - cr.left + r.width / 2,
                          y: r.top - cr.top,
                        });
                      }}
                      onMouseLeave={() => setTip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {tip && (
        <div
          className="floating-panel pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-ink shadow-lg shadow-black/40"
          style={{ left: tip.x, top: tip.y - 7 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}

function MonthlyChart({ months, t }: { months: MonthBucket[]; t: T }) {
  const W = 560;
  const H = 200;
  const padL = 8;
  const padB = 24;
  const padT = 8;
  const plotW = W - padL * 2;
  const plotH = H - padB - padT;
  const max = Math.max(1, ...months.map((m) => Math.max(m.pr, m.commit)));
  const slot = plotW / Math.max(1, months.length);
  const barW = Math.min(14, slot / 3);
  const gap = 3;
  const baseY = padT + plotH;

  return (
    <div className="h-full rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="mb-3 flex items-center gap-4 text-[12px] text-ink-muted">
        <span className="text-[13px] font-medium">{t('stats.monthly')}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" />
          {t('stats.totalPr')}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ background: 'var(--color-chart-companion)' }}
          />
          {t('stats.totalCommit')}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('stats.chartAlt')}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padL}
            y1={baseY - plotH * f}
            y2={baseY - plotH * f}
            stroke="var(--color-hairline)"
            strokeWidth={1}
          />
        ))}
        {months.map((m, i) => {
          const cx = padL + slot * i + slot / 2;
          const prH = (m.pr / max) * plotH;
          const commitH = (m.commit / max) * plotH;
          return (
            <g key={m.month}>
              <rect
                className="bar-v"
                style={{ animationDelay: `${i * 45}ms` }}
                x={cx - barW - gap / 2}
                y={baseY - prH}
                width={barW}
                height={prH}
                rx={2}
                fill="var(--color-accent)"
              >
                <title>{`${m.month} · PR ${m.pr}`}</title>
              </rect>
              <rect
                className="bar-v"
                style={{ animationDelay: `${i * 45 + 60}ms` }}
                x={cx + gap / 2}
                y={baseY - commitH}
                width={barW}
                height={commitH}
                rx={2}
                fill="var(--color-chart-companion)"
              >
                <title>{`${m.month} · commit ${m.commit}`}</title>
              </rect>
              <text
                x={cx}
                y={H - 7}
                textAnchor="middle"
                className="fill-[var(--color-ink-tertiary)] text-[11px]"
              >
                {m.month.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// 커밋 시각 기준, 머신 로컬 시간대
const TOD_PERIODS: { key: I18nKey; from: number; to: number }[] = [
  { key: 'stats.tod.dawn', from: 0, to: 5 },
  { key: 'stats.tod.morning', from: 6, to: 11 },
  { key: 'stats.tod.afternoon', from: 12, to: 17 },
  { key: 'stats.tod.evening', from: 18, to: 23 },
];

function TimeOfDayChart({ hours, t }: { hours: number[]; t: T }) {
  const buckets = TOD_PERIODS.map((p) => {
    let sum = 0;
    for (let h = p.from; h <= p.to; h++) sum += hours[h] ?? 0;
    return sum;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4">
      <span className="text-[13px] font-medium text-ink-muted">{t('stats.timeOfDay')}</span>
      <div className="mt-3 flex flex-col gap-1.5">
        {TOD_PERIODS.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* EN 라벨(Late night·Afternoon)이 안 들어가던 폭 — nowrap + 여유 폭 */}
            <span className="w-[4.5rem] shrink-0 text-[11px] whitespace-nowrap text-ink-tertiary">
              {t(p.key)}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className="bar-h h-full rounded-sm"
                style={{
                  width: `${(buckets[i]! / max) * 100}%`,
                  animationDelay: `${i * 50}ms`,
                  background: 'var(--color-accent)',
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-ink-tertiary">
              {buckets[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekdayChart({ weekday, t }: { weekday: number[]; t: T }) {
  const max = Math.max(1, ...weekday);
  const labels = [
    t('stats.dow.sun'),
    t('stats.dow.mon'),
    t('stats.dow.tue'),
    t('stats.dow.wed'),
    t('stats.dow.thu'),
    t('stats.dow.fri'),
    t('stats.dow.sat'),
  ];
  return (
    <div className="h-full rounded-lg border border-hairline bg-surface-1 p-4">
      <span className="text-[13px] font-medium text-ink-muted">{t('stats.weekday')}</span>
      <div className="mt-3 flex flex-col gap-1.5">
        {weekday.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-7 shrink-0 text-[11px] text-ink-tertiary">{labels[i]}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className="bar-h h-full rounded-sm bg-accent"
                style={{ width: `${(v / max) * 100}%`, animationDelay: `${i * 50}ms` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right font-mono text-[11px] text-ink-tertiary">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
