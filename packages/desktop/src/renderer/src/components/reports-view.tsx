import { ArrowLeft, Check, Copy, FileDown, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RecentListResult } from '../cairn-api';
import {
  addDays,
  buildLanes,
  dayIndex,
  daySpan,
  LANE_COLORS,
  orderLanesStable,
  parseDoneItems,
  timelineAxis,
  todayLocal,
  type DoneItem,
  type Lane,
} from '../lib/reports';
import {
  assembleCached,
  dailyTargets,
  initialLoadedSince,
  offScanProgress,
  REPORTS_CHUNK_DAYS,
  REPORTS_RANGE_DAYS,
  reportsRange,
  startScan,
  type PerDay,
} from '../lib/reports-scan';
import { useSettings } from '../settings-context';

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
  const { since, until } = reportsRange();

  const pages = useMemo(() => recent?.pages ?? [], [recent]);
  const targets = useMemo(() => dailyTargets(pages, since, until), [pages, since, until]);

  const [perDay, setPerDay] = useState<PerDay[] | null>(null);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  // 로드된 구간 시작일 — 진입 시 초기 청크(최근 90일)만, 좌측 스크롤 경계 근접 시 90일씩 확장
  const [loadedSince, setLoadedSince] = useState<string | null>(null);
  const [chunkLoading, setChunkLoading] = useState(false);
  // 내보내기(전체 365일 로드) 중에만 진행 바 유지 — 초기 진입은 스트리밍 렌더라 바를 숨긴다
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!recent) return;
    setLoadedSince((cur) => cur ?? initialLoadedSince(recent.pages));
  }, [recent]);

  // 로드 구간 스캔 — 세션 페이지 캐시(reports-scan) 히트는 IPC 를 생략하고 미캐시 페이지만
  // 읽는다. 스캔은 최신부터 진행되고, 페이지가 읽히는 대로 부분 렌더(스트리밍)해 전체 스캔을
  // 기다리지 않는다 — 초기 청크는 첫 페이지 전까지만 스켈레톤, 청크 확장은 가장자리 소형 표시.
  // 스캔은 뷰 이탈과 무관하게 계속되고 여기서는 진행 구독만 해제한다
  useEffect(() => {
    if (loadedSince === null) return;
    const loadedTargets = dailyTargets(pages, loadedSince, until);
    const { rows, missing } = assembleCached(loadedTargets);
    if (missing === 0) {
      setPerDay(rows);
      setScan(null);
      setChunkLoading(false);
      return;
    }
    // 청크 확장(가장자리 표시)이 아닌 로드만 인라인 진행 바 — 부분 결과가 있으면 먼저 그린다
    const inlineBar = !chunkLoading;
    setPerDay(rows.length > 0 ? rows : null);
    if (inlineBar) setScan({ done: loadedTargets.length - missing, total: loadedTargets.length });
    let alive = true;
    let raf = 0;
    // 스트리밍 — 스캔이 페이지 캐시를 최신부터 채우는 대로 부분 렌더. 페이지마다 즉시 렌더하면
    // 뚝뚝 끊겨 보이므로 프레임 단위로 묶고(rAF), 바 자체는 CSS 트랜지션으로 부드럽게 늘어난다
    const flush = (): void => {
      raf = 0;
      if (!alive) return;
      const streamed = assembleCached(loadedTargets).rows;
      if (streamed.length > 0) setPerDay(streamed);
    };
    const onProgress = (done: number, total: number): void => {
      if (!alive) return;
      if (inlineBar) setScan({ done, total });
      if (raf === 0) raf = requestAnimationFrame(flush);
    };
    void startScan(loadedSince, until, loadedTargets, onProgress).then((full) => {
      if (!alive) return;
      setPerDay(full);
      setScan(null);
      setChunkLoading(false);
    });
    return () => {
      alive = false;
      if (raf !== 0) cancelAnimationFrame(raf);
      offScanProgress(loadedSince, until, onProgress);
    };
  }, [pages, loadedSince, until, chunkLoading]);

  // 좌측 경계 근접 시 이전 90일 청크 요청 — chunkLoading 으로 직렬화
  const loadMore = useCallback(() => {
    if (chunkLoading || loadedSince === null || loadedSince <= since) return;
    setChunkLoading(true);
    setLoadedSince((cur) => {
      if (cur === null || cur <= since) return cur;
      const prev = addDays(cur, -REPORTS_CHUNK_DAYS);
      return prev < since ? since : prev;
    });
  }, [chunkLoading, loadedSince, since]);

  const items = useMemo(() => parseDoneItems(perDay ?? []), [perDay]);
  const lanes = useMemo(() => buildLanes(items), [items]);
  // 표시 순서·색은 로드에 불변인 키로 고정한다 — 최근 활동일(last) 내림차순, 동률은 레포명.
  // 과거 청크를 더 불러와도 기존 레인의 last 는 안 바뀌고 더 오래된 레포만 아래로 붙어,
  // 레이지 로드 때 레인 재정렬·재배색이 없다(진입/스크롤 튐 방지). 색도 이 순서 인덱스로 고정
  const orderedLanes = useMemo(() => orderLanesStable(lanes), [lanes]);
  const laneColor = useMemo(() => {
    const m = new Map<string, string>();
    orderedLanes.forEach((l, i) => m.set(laneKey(l.repo), LANE_COLORS[i % LANE_COLORS.length]!));
    return m;
  }, [orderedLanes]);
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
  const buildMarkdown = (rows: PerDay[]): string => {
    const byMonth = new Map<string, string[]>();
    for (const d of rows) {
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
  };

  // 내보내기는 고정 범위(365일) 전체 기준 — 미로드 구간이 있으면 먼저 전체를 로드하고
  // (그때만 인라인 진행 바), 로드 완료된 rows 로 md 를 만든다
  const allRows = async (): Promise<PerDay[] | null> => {
    if (perDay === null) return null;
    if (loadedSince !== null && loadedSince <= since) return perDay;
    const missingAll = assembleCached(targets).missing;
    if (missingAll > 0) {
      setExporting(true);
      setScan({ done: targets.length - missingAll, total: targets.length });
    }
    try {
      const rows = await startScan(since, until, targets, (done, total) =>
        setScan({ done, total }),
      );
      setLoadedSince(since);
      return rows;
    } finally {
      setScan(null);
      setExporting(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const filename = `worklog-last-${REPORTS_RANGE_DAYS}d.md`;

  function copyMd() {
    void allRows().then((rows) => {
      if (!rows) return;
      void navigator.clipboard.writeText(buildMarkdown(rows)).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    });
  }

  function saveMd() {
    void allRows().then((rows) => {
      if (!rows) return;
      void window.cairn.exportMarkdown(filename, buildMarkdown(rows)).then((r) => {
        if (!r.saved) return;
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      });
    });
  }

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
  const scanning = scan !== null;
  const ready = perDay !== null;

  const detailRows = selectedRepo !== null ? (itemsByLane.get(selectedRepo) ?? []) : [];
  const detailDays = new Set(detailRows.map((r) => r.date)).size;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-canvas">
      <div className="h-20 shrink-0 [-webkit-app-region:drag]" />
      <header className="shrink-0 pb-4">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-6">
          <span className="shrink-0 text-[12px] text-ink-tertiary">
            {targets.length}
            {t('achv.worklogs')}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={copyMd}
              disabled={!ready}
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
              disabled={!ready}
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
        {/* 내보내기 전체 로드 때만 얇은 진행 바 — 초기 진입은 스트리밍 렌더라 바 없이 내용이 채워진다 */}
        {scanning && exporting && (
          <div className="mx-auto mt-3 flex w-full max-w-5xl items-center gap-2.5 px-6">
            <div
              role="progressbar"
              aria-label={t('achv.scanning')}
              aria-valuemin={0}
              aria-valuemax={scan?.total ?? 0}
              aria-valuenow={scan?.done ?? 0}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                style={{
                  width: `${scan && scan.total > 0 ? (scan.done / scan.total) * 100 : 0}%`,
                }}
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] text-ink-tertiary tabular-nums">
              {scan?.done ?? 0}/{scan?.total ?? 0}
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="panel-enter mx-auto w-full max-w-5xl px-6 pb-8">
          {!recent ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-ink-tertiary">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              {t('list.loading')}
            </div>
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
                  until={until}
                  lanes={orderedLanes}
                  laneColor={laneColor}
                  laneLabel={laneLabel}
                  loadedSince={loadedSince ?? since}
                  loadingEdge={chunkLoading}
                  revealing={scanning}
                  onNeedMore={loadMore}
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
                  {orderedLanes.map((lane) => (
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
                        color={laneColor.get(laneKey(lane.repo))!}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : scanning ? (
            <ScanSkeleton />
          ) : null}
        </div>
      </div>
    </section>
  );
}

// 초기 청크 스캔 동안의 자리 표시 — 실 레이아웃(타임라인 레인·레포 테이블)을 본뜬 스켈레톤.
// 부분 조립이 렌더를 시작하면 실데이터가 대체한다. 모션은 pulse 만
function ScanSkeleton() {
  const { t } = useSettings();
  const laneShapes = [
    { left: '2%', width: '34%' },
    { left: '20%', width: '46%' },
    { left: '46%', width: '38%' },
    { left: '68%', width: '28%' },
  ];
  return (
    <div className="animate-pulse flex flex-col gap-7" aria-hidden="true">
      <div>
        <p className="mb-2 px-1 text-[11px] font-medium tracking-wider text-ink-tertiary uppercase">
          {t('reports.timeline')}
        </p>
        <div className="flex flex-col gap-6 py-1.5">
          {laneShapes.map((s, i) => (
            <div key={i}>
              <div style={{ marginLeft: s.left }} className="h-3 w-28 rounded bg-surface-2" />
              <div
                style={{ marginLeft: s.left, width: s.width }}
                className="mt-1.5 h-6 rounded-[5px] bg-surface-2/60"
              />
            </div>
          ))}
        </div>
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
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex h-10 items-center gap-3 px-2">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-40 rounded bg-surface-2" />
            </div>
            <div className="flex w-10 shrink-0 justify-end">
              <div className="h-3 w-8 rounded bg-surface-2" />
            </div>
            <div className="flex w-24 shrink-0 justify-end">
              <div className="h-2 w-20 rounded-full bg-surface-2/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
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

// 일당 고정 px 스케일 — 365일 × 7px ≈ 2555px 를 가로 스크롤로 훑는다
const PX_PER_DAY = 7;

function Timeline({
  until,
  lanes,
  laneColor,
  laneLabel,
  loadedSince,
  loadingEdge,
  revealing,
  onNeedMore,
  onLaneClick,
}: {
  until: string;
  lanes: Lane[];
  laneColor: Map<string, string>;
  laneLabel: (repo: string | null) => string;
  loadedSince: string;
  loadingEdge: boolean;
  revealing: boolean;
  onNeedMore: () => void;
  onLaneClick: (lane: Lane) => void;
}) {
  // 축·트랙·바 위치의 기준 범위는 loadedSince..until — 로드된 구간만 그려, 왼쪽 청크가
  // 로드되면 트랙이 왼쪽으로 자란다. 미로드 구간은 트랙 밖이라 뷰포트에 보이지 않는다.
  // lanes 는 부모에서 이미 고정 순서(최근 활동일 순)로 정렬돼 오고, 색은 laneColor 로 받는다
  const span = daySpan(loadedSince, until);
  const axis = timelineAxis(loadedSince, until);

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

  // 스크롤 앵커 — 오늘(오른쪽 끝) 픽셀을 고정한다. 왼쪽 청크 로드로 트랙이 넓어지면
  // 늘어난 폭만큼 scrollLeft 를 밀어 보고 있던 위치를 그대로 유지(시각적 점프 방지).
  // 최초 로드(prev 없음)엔 오른쪽 끝(오늘)으로 스크롤
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevScrollWidthRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = prevScrollWidthRef.current;
    if (prev === null) el.scrollLeft = el.scrollWidth;
    else el.scrollLeft += el.scrollWidth - prev;
    prevScrollWidthRef.current = el.scrollWidth;
  }, [loadedSince]);

  // 좌측 로드 경계 감지 — 로드된 구간 왼쪽 끝(loadedSince)이 트랙 좌단이라, 사용자가 왼쪽
  // 경계 300px 안으로 스크롤할 때 이전 청크를 요청한다. 진입 시엔 오른쪽 끝(오늘)에 앵커돼
  // 있어 스크롤로 과거를 훑을 때만 로드된다
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = (): void => {
      if (el.scrollWidth > el.clientWidth && el.scrollLeft < 300) onNeedMore();
    };
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, [onNeedMore]);

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

        <div className="relative mt-3 flex flex-col">
          {/* 청크 로딩 — 트랙 왼쪽 가장자리(로드 경계)의 소형 표시 */}
          {loadingEdge && (
            <span
              className="absolute top-1/2 left-1 -translate-y-1/2 text-ink-tertiary"
              aria-hidden="true"
            >
              <Loader2 size={12} strokeWidth={2} className="animate-spin" />
            </span>
          )}
          {lanes.map((lane, idx) => {
            const color = laneColor.get(laneKey(lane.repo))!;
            const first = lane.dates[0]!;
            const last = lane.dates[lane.dates.length - 1]!;
            const left = (dayIndex(loadedSince, first) / span) * 100;
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
              <div key={laneKey(lane.repo)} className="lane-reveal">
                {/* 높이 0→auto 로 펼쳐지는 클립 영역 — 간격(pt)도 이 안에 넣어 함께 자란다 */}
                <div className={`relative pb-1.5 text-left ${idx > 0 ? 'pt-6' : 'pt-1.5'}`}>
                  <span
                    style={{ marginLeft: `${labelLeft}%`, maxWidth: `${100 - labelLeft}%` }}
                    // 막대가 스트리밍으로 왼쪽으로 자랄 때 레이블도 같은 등속 트랜지션으로 따라가게 —
                    // 트랜지션이 없으면 데이터 들어올 때마다 순간이동해 저프레임처럼 끊겨 보인다
                    className="flex w-fit items-baseline gap-1.5 pl-0.5 whitespace-nowrap transition-[margin] duration-[600ms] ease-linear"
                  >
                    <span
                      style={{ background: color }}
                      className="size-1.5 shrink-0 self-center rounded-full"
                      aria-hidden="true"
                    />
                    <span className="truncate text-[13px] font-medium text-ink-muted">
                      {laneLabel(lane.repo)}
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-tertiary tabular-nums">
                      {lane.count}
                    </span>
                  </span>
                  <span className="relative mt-1.5 block h-7">
                    {/* 막대 자체가 클릭 대상 — 누르면 그 레포 작업 내역을 연다. 넓은 행 hover 없이
                      cursor 포인터로만 클릭 가능함을 알린다 */}
                    <button
                      type="button"
                      onClick={() => onLaneClick(lane)}
                      aria-label={`${laneLabel(lane.repo)} · ${lane.count}`}
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
                      // 스트리밍으로 바 구간이 채워질 때 left·width 가 스르륵 늘어나게 — 스트리밍은
                      // 목표값이 계속 갱신되므로 등속(linear)이라야 이어지는 글라이드로 부드럽다
                      className="absolute inset-y-0 cursor-pointer rounded-[5px] border transition-[left,width] duration-[600ms] ease-linear"
                    />
                    {/* 다이아(피크)는 스캔 중엔 숨긴다 — top-2 가 계속 재계산돼 위치가 튀기 때문.
                      스캔이 끝나 확정된 뒤 제자리에서 페이드로 드러난다. 클릭은 막대로 통과 */}
                    {!revealing &&
                      lane.peaks.map((p) => (
                        <span
                          key={p.date}
                          style={{
                            left: `${((dayIndex(loadedSince, p.date) + 0.5) / span) * 100}%`,
                            background: color,
                          }}
                          className="fade-in pointer-events-none absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]"
                        />
                      ))}
                  </span>
                  {!revealing && labeledPeaks.length > 0 && (
                    <span className="pointer-events-none relative mt-1 block h-3.5">
                      {labeledPeaks.map((p) => (
                        <span
                          key={p.date}
                          style={{
                            left: `${((dayIndex(loadedSince, p.date) + 0.5) / span) * 100}%`,
                          }}
                          className="fade-in absolute top-0 -translate-x-1/2 text-[11px] whitespace-nowrap text-ink-tertiary"
                        >
                          {peakLabel(p.date)}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
