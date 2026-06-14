import { CalendarCheck, Flame, GitCommitHorizontal, GitPullRequest } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { RecentListResult, RecentPage } from '../cairn-api';
import type { I18nKey } from '../i18n';
import { useSettings } from '../settings-context';

type T = (key: I18nKey) => string;

// "gh:3 / git:5" → { pr: 3, commit: 5 }. listRecentPages 가 채우는 Source counts 문자열.
function parseCounts(sourceCounts: string | null): { pr: number; commit: number } {
  if (!sourceCounts) return { pr: 0, commit: 0 };
  const pr = /gh\s*:\s*(\d+)/i.exec(sourceCounts);
  const commit = /git\s*:\s*(\d+)/i.exec(sourceCounts);
  return { pr: pr ? Number(pr[1]) : 0, commit: commit ? Number(commit[1]) : 0 };
}

type DayActivity = { date: string; pr: number; commit: number; total: number };
type MonthBucket = { month: string; pr: number; commit: number; activeDays: number };

// "... / hrs:c0,..,c23" → 24칸 시간 히스토그램(없으면 null). 발행기가 채움(머신 로컬 시간).
function parseHours(sourceCounts: string | null): number[] | null {
  if (!sourceCounts) return null;
  const m = /hrs:([\d,]+)/.exec(sourceCounts);
  if (!m) return null;
  const arr = m[1]!.split(',').map(Number);
  return arr.length === 24 && arr.every(Number.isFinite) ? arr : null;
}

type Agg = {
  byDate: Map<string, DayActivity>;
  months: MonthBucket[];
  weekday: number[]; // 일~토 7칸: 총 활동량
  hours: number[]; // 0~23시 24칸: 커밋 시간대 분포
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
    const { pr, commit } = parseCounts(p.sourceCounts);
    const hrs = parseHours(p.sourceCounts);
    if (hrs) for (let i = 0; i < 24; i++) hours[i]! += hrs[i]!;
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

// 활동 있는 날의 연속(현재/최장). 현재 streak 은 오늘 또는 어제부터 거슬러 셈.
function computeStreak(byDate: Map<string, DayActivity>): { current: number; longest: number } {
  const active = new Set([...byDate.values()].filter((d) => d.total > 0).map((d) => d.date));
  if (active.size === 0) return { current: 0, longest: 0 };

  let longest = 0;
  let run = 0;
  const sorted = [...active].sort();
  let prev: Date | null = null;
  for (const ds of sorted) {
    const d = new Date(`${ds}T00:00:00`);
    if (prev && (d.getTime() - prev.getTime()) / 86400000 === 1) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!active.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1); // 오늘 미발행이면 어제부터
  while (active.has(isoDay(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}

const HEATMAP_WEEKS = 53; // GitHub 잔디처럼 1년치
const CELL = 12; // 셀 한 변(px) — 작고 촘촘하게
const CELL_GAP = 3;

export function Dashboard({
  recent,
  onPickDate,
  onGoToWorklogs,
}: {
  recent: RecentListResult | null;
  onPickDate?: (date: string) => void;
  onGoToWorklogs?: () => void;
}) {
  const { t } = useSettings();
  const data = useMemo(() => aggregate(recent?.pages ?? []), [recent]);
  const recentMonths = data.months.slice(-12);

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-5xl px-6 pb-10">
          <h1 className="pb-1 text-[20px] font-semibold tracking-[-0.3px] text-ink">
            {t('stats.title')}
          </h1>
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
              <div
                className="dash-rise grid grid-cols-2 gap-3 sm:grid-cols-4"
                style={{ animationDelay: '0ms' }}
              >
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
              </div>

              <div className="dash-rise" style={{ animationDelay: '80ms' }}>
                <Heatmap byDate={data.byDate} t={t} onPickDate={onPickDate} />
              </div>

              <div
                className="dash-rise grid grid-cols-1 gap-6 lg:grid-cols-3"
                style={{ animationDelay: '160ms' }}
              >
                <div className="lg:col-span-2">
                  <MonthlyChart months={recentMonths} t={t} />
                </div>
                <WeekdayChart weekday={data.weekday} t={t} />
              </div>

              {data.hours.some((h) => h > 0) && (
                <div className="dash-rise" style={{ animationDelay: '220ms' }}>
                  <TimeOfDayChart hours={data.hours} t={t} />
                </div>
              )}

              <p
                className="dash-rise text-[11px] text-ink-tertiary"
                style={{ animationDelay: '280ms' }}
              >
                {t('stats.note')}
              </p>
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

// GitHub 잔디 스타일 — 최근 HEATMAP_WEEKS 주, 날짜별 활동량을 accent 농도로.
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
    // 이번 주 토요일까지 채운 뒤 HEATMAP_WEEKS 주 전 일요일부터 시작
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

  // 마우스 올린 셀의 날짜·활동량을 셀 위에 떠 있는 커스텀 툴팁으로.
  // 좌표는 컨테이너 기준 상대값(absolute) — fixed 는 transform 가진 상위(.dash-rise)에서
  // viewport 가 아닌 그 요소 기준이 돼 위치가 틀어지고 스크롤바가 생긴다.
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
          {/* 요일 라벨 — 월·수·금만 (GitHub 스타일) */}
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
          {/* 잔디 — 고정 작은 셀로 촘촘하게 */}
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
          className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-ink shadow-lg shadow-black/40"
          style={{ left: tip.x, top: tip.y - 7 }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}

// 월별 PR·커밋 그룹 막대 — 외부 차트 라이브러리 없이 SVG. 최근 12개월.
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
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--color-ink-subtle)' }} />
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
                fill="var(--color-ink-subtle)"
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

// 시간대별 작업 분포 — 새벽/오전/오후/밤 중 언제 주로 일하는지 (커밋 시각 기준, 머신 로컬)
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
            <span className="w-12 shrink-0 text-[11px] text-ink-tertiary">{t(p.key)}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-sm bg-surface-2">
              <div
                className="bar-h h-full rounded-sm bg-accent"
                style={{ width: `${(buckets[i]! / max) * 100}%`, animationDelay: `${i * 50}ms` }}
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

// 요일별 활동량 — 어느 요일에 가장 활발한지
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
