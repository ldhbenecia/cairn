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

type Agg = {
  byDate: Map<string, DayActivity>;
  months: MonthBucket[];
  weekday: number[]; // 일~토 7칸: 총 활동량
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

  for (const p of pages) {
    if (p.category !== 'daily' || !p.date) continue;
    const { pr, commit } = parseCounts(p.sourceCounts);
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

  return { byDate, months, weekday, total, streak: computeStreak(byDate) };
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

const HEATMAP_WEEKS = 18;

export function Dashboard({ recent }: { recent: RecentListResult | null }) {
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
            <p className="rounded-lg border border-hairline bg-surface-1 py-16 text-center text-[12px] text-ink-tertiary">
              {t('stats.empty')}
            </p>
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
                <Heatmap byDate={data.byDate} t={t} />
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

              <p
                className="dash-rise text-[11px] text-ink-tertiary"
                style={{ animationDelay: '220ms' }}
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
function Heatmap({ byDate, t }: { byDate: Map<string, DayActivity>; t: T }) {
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
      <div className="flex gap-1">
        {weeks.cols.map((col, ci) => (
          <div key={ci} className="flex flex-1 flex-col gap-1">
            {col.map((cell) => (
              <span
                key={cell.date}
                className="aspect-square w-full rounded-[3px] transition-transform hover:scale-110"
                style={{
                  background: cell.future ? 'transparent' : LEVEL_BG[level(cell.total)],
                  maxWidth: 18,
                }}
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
            ))}
          </div>
        ))}
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
