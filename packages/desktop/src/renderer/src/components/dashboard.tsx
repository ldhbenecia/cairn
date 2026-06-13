import { GitCommitHorizontal, GitPullRequest, CalendarCheck, Flame } from 'lucide-react';
import { useMemo } from 'react';
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

type MonthBucket = { month: string; pr: number; commit: number; activeDays: number };

function aggregate(pages: RecentPage[]): {
  months: MonthBucket[];
  total: { pr: number; commit: number; activeDays: number; activeMonths: number };
} {
  const byMonth = new Map<string, { pr: number; commit: number; days: Set<string> }>();
  for (const p of pages) {
    if (p.category !== 'daily' || !p.date) continue;
    const month = p.date.slice(0, 7); // YYYY-MM
    const { pr, commit } = parseCounts(p.sourceCounts);
    const b = byMonth.get(month) ?? { pr: 0, commit: 0, days: new Set<string>() };
    b.pr += pr;
    b.commit += commit;
    if (pr + commit > 0) b.days.add(p.date);
    byMonth.set(month, b);
  }
  const months = [...byMonth.entries()]
    .map(([month, b]) => ({ month, pr: b.pr, commit: b.commit, activeDays: b.days.size }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const total = months.reduce(
    (acc, m) => ({
      pr: acc.pr + m.pr,
      commit: acc.commit + m.commit,
      activeDays: acc.activeDays + m.activeDays,
      activeMonths: acc.activeMonths + (m.pr + m.commit > 0 ? 1 : 0),
    }),
    { pr: 0, commit: 0, activeDays: 0, activeMonths: 0 },
  );
  return { months, total };
}

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
          ) : data.months.length === 0 ? (
            <p className="rounded-lg border border-hairline bg-surface-1 py-16 text-center text-[12px] text-ink-tertiary">
              {t('stats.empty')}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 pb-7 sm:grid-cols-4">
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
                  label={t('stats.activeMonths')}
                  value={data.total.activeMonths}
                />
              </div>

              <MonthlyChart months={recentMonths} t={t} />

              <p className="pt-4 text-[11px] text-ink-tertiary">{t('stats.note')}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-hairline bg-surface-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-[12px] text-ink-tertiary">
        {icon}
        {label}
      </span>
      <span className="font-mono text-[24px] font-semibold tracking-[-0.5px] text-ink">
        {value}
      </span>
    </div>
  );
}

// 월별 PR·커밋 그룹 막대 — 외부 차트 라이브러리 없이 SVG. 최근 12개월.
function MonthlyChart({ months, t }: { months: MonthBucket[]; t: T }) {
  const W = 720;
  const H = 220;
  const padL = 8;
  const padB = 26;
  const padT = 8;
  const plotW = W - padL * 2;
  const plotH = H - padB - padT;
  const max = Math.max(1, ...months.map((m) => Math.max(m.pr, m.commit)));
  const slot = plotW / months.length;
  const barW = Math.min(16, slot / 3);
  const gap = 3;

  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="mb-3 flex items-center gap-4 text-[12px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-accent" />
          {t('stats.totalPr')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: 'var(--color-ink-subtle)' }} />
          {t('stats.totalCommit')}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('stats.chartAlt')}>
        {months.map((m, i) => {
          const cx = padL + slot * i + slot / 2;
          const prH = (m.pr / max) * plotH;
          const commitH = (m.commit / max) * plotH;
          const baseY = padT + plotH;
          const label = m.month.slice(5); // MM
          return (
            <g key={m.month}>
              <rect
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
                y={H - 8}
                textAnchor="middle"
                className="fill-[var(--color-ink-tertiary)] text-[11px]"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
