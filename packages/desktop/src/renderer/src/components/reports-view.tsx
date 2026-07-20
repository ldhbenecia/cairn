import { ArrowLeft, Check, Copy, FileDown, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import type { I18nKey } from '../i18n';
import {
  buildLanes,
  dayIndex,
  daySpan,
  LANE_COLORS,
  localDateDaysAgo,
  parseDoneItems,
  timelineAxis,
  todayLocal,
  type DoneItem,
  type Lane,
} from '../lib/reports';
import {
  cachedScan,
  dailyTargets,
  offScanProgress,
  rememberReportsRange,
  startScan,
  type PerDay,
} from '../lib/reports-scan';
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

// 상세 뷰 — 날짜 내림차순으로 정렬된 항목을 날짜별 섹션으로 묶는다
function groupByDate(rows: readonly DoneItem[]): { date: string; items: DoneItem[] }[] {
  const groups: { date: string; items: DoneItem[] }[] = [];
  for (const it of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }
  return groups;
}

// split 캡처 그룹 — 홀수 인덱스가 #N 매치
const PR_REF_RE = /(#\d+)/g;

function DoneText({ text }: { text: string }) {
  const parts = text.split(PR_REF_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-mono text-[12px] font-medium text-ink tabular-nums">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

export function ReportsView({ recent }: { recent: RecentListResult | null }) {
  const { t } = useSettings();
  const [range, setRange] = useState<RangeKey>(30);
  const [customFrom, setCustomFrom] = useState<string>(() => localDateDaysAgo(30));
  const [customTo, setCustomTo] = useState<string>(todayLocal);
  const since = range === 'custom' ? customFrom : localDateDaysAgo(range);
  const until = range === 'custom' ? customTo : todayLocal();

  const pages = useMemo(() => recent?.pages ?? [], [recent]);
  const targets = useMemo(() => dailyTargets(pages, since, until), [pages, since, until]);

  const [perDay, setPerDay] = useState<PerDay[] | null>(null);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);

  // 모듈 레벨 캐시(reports-scan) — 뷰 재진입 시 즉시 렌더, 일지 수가 달라졌거나 디스크
  // 복원본이면 이전 결과를 보여둔 채 뒤에서 재스캔 (stale-while-revalidate). 스캔은 뷰
  // 이탈과 무관하게 계속되고, 여기서는 진행 상태만 구독/해제한다. 스피너는 캐시가 전혀 없을 때만
  useEffect(() => {
    const entry = cachedScan(since, until);
    if (entry) {
      setPerDay(entry.rows);
      setScan(null);
      if (entry.count === targets.length && !entry.disk) return;
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
    const onProgress = (done: number, total: number): void => {
      if (alive && !entry) setScan({ done, total });
    };
    void startScan(since, until, targets, onProgress).then((rows) => {
      if (!alive) return;
      setPerDay(rows);
      setScan(null);
    });
    return () => {
      alive = false;
      offScanProgress(since, until, onProgress);
    };
  }, [since, until, targets]);

  const items = useMemo(() => parseDoneItems(perDay ?? []), [perDay]);
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
                aria-pressed={range === p.key}
                onClick={() => {
                  setRange(p.key);
                  // custom 은 날짜가 상대 기간과 안 맞아 기억 대상에서 제외
                  if (p.key !== 'custom') rememberReportsRange(p.key);
                }}
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
                  <h2 className="truncate text-[18px] font-semibold tracking-[-0.3px] text-ink">
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
                <div className="flex max-w-3xl flex-col gap-6">
                  {groupByDate(detailRows).map((g) => (
                    <section key={g.date}>
                      <h3 className="mb-1 px-2 font-mono text-[11.5px] font-medium text-ink-tertiary tabular-nums">
                        {g.date}
                      </h3>
                      <div>
                        {g.items.map((it, i) => (
                          <div
                            key={i}
                            className="flex min-h-8 items-center gap-3 rounded-md px-2 py-1.5 transition-[background-color] hover:bg-surface-2"
                          >
                            <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-muted">
                              <DoneText text={it.text} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
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
                  {lanes.map((lane, i) => (
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
                      <ActivitySpark
                        since={since}
                        until={until}
                        dates={lane.dates}
                        color={LANE_COLORS[i % LANE_COLORS.length]!}
                      />
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

// 레포 헤더 행 우측의 기간 활동 미니 표시 — Timeline 도트 문법의 축소판, 레인 색 공유
function ActivitySpark({
  since,
  until,
  dates,
  color,
}: {
  since: string;
  until: string;
  dates: string[];
  color: string;
}) {
  const span = daySpan(since, until);
  return (
    <span className="relative h-4 w-24 shrink-0" aria-hidden="true">
      {dates.map((d) => (
        <span
          key={d}
          style={{ left: `${((dayIndex(since, d) + 0.5) / span) * 100}%`, background: color }}
          className="absolute top-1/2 size-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full"
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

// 월 라벨 — 영문 3글자 대문자 고정 (APR/MAY)
const monthLabel = (date: string): string =>
  new Date(2000, Number(date.slice(5, 7)) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();

// 마일스톤 라벨 — 다이아 아래 날짜 단축 표기, 월 라벨과 같은 en-US 고정 ('Jul 4')
const peakLabel = (date: string): string =>
  new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// 진행 중 판정 — 마지막 활동일이 기간 끝 3일 이내(오늘 포함). 문자열 달력 산술이라 TZ 무관
const isOngoing = (last: string, until: string): boolean =>
  dayIndex(last, until) <= 3 || last === todayLocal();

// 기간이 길면 일당 고정 px 로 내용 폭을 키워 가로 스크롤 — 짧으면 컨테이너 100%
const PX_PER_DAY = 10;

function Timeline({
  since,
  until,
  lanes,
  laneLabel,
  onLaneClick,
}: {
  since: string;
  until: string;
  lanes: Lane[];
  laneLabel: (repo: string | null) => string;
  onLaneClick: (lane: Lane) => void;
}) {
  const span = daySpan(since, until);
  const axis = timelineAxis(since, until);
  // 색은 buildLanes(건수순) 인덱스로 고정 — 레포별 작업 테이블·Wrapped 팔레트와 배정이 일치
  const colorOf = new Map(
    lanes.map((l, i) => [laneKey(l.repo), LANE_COLORS[i % LANE_COLORS.length]!]),
  );
  // 표시 순서는 시작일 순 — 바가 좌상단에서 우하단으로 계단식 스태거
  const ordered = [...lanes].sort(
    (a, b) => a.dates[0]!.localeCompare(b.dates[0]!) || b.count - a.count,
  );

  // 트랙 실측 폭 — 마일스톤 라벨 겹침 판정(px)용
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 기간 변경 시 최신(오른쪽 끝)이 보이게 스크롤
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [since, until]);

  // 순차 이행 연결 — 레인 A 마지막 활동일 뒤에 시작하는 가장 가까운 후속 레인으로 최대 1개
  const links = useMemo(() => {
    const out: { from: string; to: string }[] = [];
    for (const a of lanes) {
      const aLast = a.dates[a.dates.length - 1]!;
      let best: Lane | undefined;
      for (const b of lanes) {
        if (b === a || b.dates[0]! <= aLast) continue;
        if (!best || b.dates[0]! < best.dates[0]!) best = b;
      }
      if (best) out.push({ from: laneKey(a.repo), to: laneKey(best.repo) });
    }
    return out;
  }, [lanes]);

  // 바 실측 rect 기반 S커브 경로 — 수평 진출→수직 이동→수평 진입 cubic bezier
  const barRefs = useRef(new Map<string, HTMLSpanElement>());
  const [linkPaths, setLinkPaths] = useState<string[]>([]);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || links.length === 0) {
      setLinkPaths([]);
      return;
    }
    const base = track.getBoundingClientRect();
    const paths: string[] = [];
    for (const { from, to } of links) {
      const a = barRefs.current.get(from)?.getBoundingClientRect();
      const b = barRefs.current.get(to)?.getBoundingClientRect();
      if (!a || !b) continue;
      const x1 = a.right - base.left;
      const x2 = b.left - base.left;
      // 진행 중 연장·최소 폭 클램프로 바 끝이 겹치면 생략
      if (x2 - x1 < 8) continue;
      const y1 = a.top + a.height / 2 - base.top;
      const y2 = b.top + b.height / 2 - base.top;
      const mx = (x1 + x2) / 2;
      paths.push(`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
    }
    setLinkPaths(paths);
  }, [links, trackWidth]);

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1">
      <div ref={trackRef} style={{ minWidth: span * PX_PER_DAY }} className="relative">
        {/* 세로 점선 hairline — 축 아래부터 섹션 전체 높이 관통 (풀블리드, 박스 없음) */}
        <div className="pointer-events-none absolute inset-x-0 top-12 bottom-0">
          {axis.days.map((tk) => (
            <span
              key={tk.date}
              style={{ left: `${tk.pos * 100}%` }}
              className="absolute inset-y-0 border-l border-dashed border-hairline"
              aria-hidden="true"
            />
          ))}
        </div>

        {/* 축 — 월 라벨 행 */}
        <div className="relative h-6">
          {axis.months.map((tk) => (
            <span
              key={tk.date}
              style={{ left: `${tk.pos * 100}%` }}
              className="absolute top-0 pl-1 text-[13px] font-medium tracking-[0.4px] whitespace-nowrap text-ink-subtle"
            >
              {monthLabel(tk.date)}
            </span>
          ))}
        </div>
        {/* 축 — 틱 마크 행 (짧은 세로 눈금선 + 일 숫자) */}
        <div className="relative h-6 border-t border-hairline">
          {axis.days.map((tk) => (
            <span
              key={tk.date}
              style={{ left: `${tk.pos * 100}%` }}
              className={`absolute top-0 flex flex-col ${
                tk.pos === 0 ? 'items-start' : '-translate-x-1/2 items-center'
              }`}
            >
              <span className="h-[5px] w-px bg-hairline-strong" aria-hidden="true" />
              <span className="mt-[3px] text-[11px] leading-none text-ink-tertiary tabular-nums">
                {Number(tk.date.slice(8, 10))}
              </span>
            </span>
          ))}
        </div>

        <div className="relative mt-3 flex flex-col gap-6">
          {ordered.map((lane) => {
            const color = colorOf.get(laneKey(lane.repo))!;
            const first = lane.dates[0]!;
            const last = lane.dates[lane.dates.length - 1]!;
            const left = (dayIndex(since, first) / span) * 100;
            // 라벨 행은 바 시작 x 에 정렬 — 우측 끝 레인만 잘리지 않게 클램프
            const labelLeft = Math.min(left, 78);
            // 진행 중이면 바를 기간 끝까지 연장 후 오른쪽 끝을 페이드로 오픈
            const ongoing = isOngoing(last, until);
            const barEnd = ongoing ? until : last;
            // 다이아 라벨 — 날짜순, 앞 라벨과 60px 미만이면 뒤 것 생략 (실측 전엔 모두 표시)
            const peaksByDate = [...lane.peaks].sort((a, b) => a.date.localeCompare(b.date));
            const labeledPeaks = peaksByDate.filter((p, i) => {
              if (i === 0 || trackWidth === 0) return true;
              const gap = dayIndex(peaksByDate[i - 1]!.date, p.date);
              return (gap / span) * trackWidth >= 60;
            });
            return (
              <button
                key={laneKey(lane.repo)}
                type="button"
                onClick={() => onLaneClick(lane)}
                title={`${laneLabel(lane.repo)} · ${lane.count}`}
                className="group relative block w-full rounded-md py-1.5 text-left transition-[background-color] hover:bg-surface-2/40"
              >
                <span
                  style={{ marginLeft: `${labelLeft}%`, maxWidth: `${100 - labelLeft}%` }}
                  className="flex w-fit items-baseline gap-1.5 pl-0.5 whitespace-nowrap"
                >
                  <span
                    style={{ background: color }}
                    className="size-1.5 shrink-0 self-center rounded-full"
                    aria-hidden="true"
                  />
                  <span className="truncate text-[13px] font-medium text-ink-muted transition-colors group-hover:text-ink">
                    {laneLabel(lane.repo)}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-tertiary tabular-nums">
                    {lane.count}
                  </span>
                </span>
                <span className="relative mt-1.5 block h-7">
                  <span
                    ref={(el) => {
                      const key = laneKey(lane.repo);
                      if (el) barRefs.current.set(key, el);
                      else barRefs.current.delete(key);
                    }}
                    style={{
                      left: `${left}%`,
                      width: `${(daySpan(first, barEnd) / span) * 100}%`,
                      // 단일 활동일도 원형 알약이 아니라 짧은 바로 보이게
                      minWidth: 24,
                      // 채움은 거의 투명 — 배경 위에 살짝 얹힌 유리 질감
                      background: `color-mix(in srgb, ${color} 6%, transparent)`,
                      borderColor: `${color}38`,
                      // 진행 중 — 마지막 ~64px 를 mask 로 페이드 (보더째 흐려짐), 짧은 바는 절반 보전
                      maskImage: ongoing
                        ? 'linear-gradient(to right, #000 max(50%, 100% - 64px), transparent)'
                        : undefined,
                    }}
                    className="absolute inset-y-0 rounded-[5px] border"
                  />
                  {lane.peaks.map((p) => (
                    <span
                      key={p.date}
                      title={`${p.date} · ${p.count}`}
                      style={{
                        left: `${((dayIndex(since, p.date) + 0.5) / span) * 100}%`,
                        background: color,
                      }}
                      className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]"
                    />
                  ))}
                </span>
                {labeledPeaks.length > 0 && (
                  <span className="relative mt-1 block h-3.5">
                    {labeledPeaks.map((p) => (
                      <span
                        key={p.date}
                        style={{ left: `${((dayIndex(since, p.date) + 0.5) / span) * 100}%` }}
                        className="absolute top-0 -translate-x-1/2 text-[11px] whitespace-nowrap text-ink-tertiary"
                      >
                        {peakLabel(p.date)}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 순차 이행 S커브 오버레이 — 스크롤 캔버스 내부라 좌표가 바와 함께 이동 */}
        {linkPaths.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
            {linkPaths.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="var(--color-hairline-strong)"
                strokeWidth="1"
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
