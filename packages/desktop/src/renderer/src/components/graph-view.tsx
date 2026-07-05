import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { GraphConfig, GraphLabels, RecentListResult, RecentPage } from '../cairn-api';
import { useSettings } from '../settings-context';
import type { I18nKey } from '../i18n';

type Kind = 'daily' | 'weekly' | 'monthly';

type GraphNode = {
  page: RecentPage;
  kind: Kind;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type Graph = { nodes: GraphNode[]; edges: [number, number][]; neighbors: Set<number>[] };

const COLOR: Record<Kind, string> = {
  daily: '#8a8f98',
  weekly: '#757bf0',
  monthly: '#5b61e6',
};
const EDGE_COLOR = 'rgba(98, 102, 109, 0.28)';
const EDGE_HI = 'rgba(117, 123, 240, 0.75)';
const LABEL_COLOR = '#8a8f98';
const LABEL_HI = '#f7f8f8';

// 날짜 문자열(YYYY-MM-DD) 달력 산술 — core period-range 와 동일하게 파싱값을 UTC 로만 계산
// (로컬 TZ 무관: 문자열 in → 문자열 out)
function isoWeekEnd(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || d === undefined) return date;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const sunday = new Date(Date.UTC(y, m - 1, d + (dow === 0 ? 0 : 7 - dow)));
  return `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
}

function buildGraph(pages: RecentPage[], showRollups: boolean): Graph {
  const dated = pages.filter((p) => p.date !== null && (showRollups || p.category === 'daily'));
  const nodes: GraphNode[] = dated.map((page) => {
    const kind = page.category;
    const activity = (page.pr ?? 0) + (page.commit ?? 0);
    const r =
      kind === 'monthly'
        ? 15
        : kind === 'weekly'
          ? 9
          : 3.5 + Math.min(5, Math.sqrt(activity) * 1.4);
    return { page, kind, r, x: 0, y: 0, vx: 0, vy: 0 };
  });

  const weeklyIdx = new Map<string, number>();
  const monthlyIdx = new Map<string, number>();
  nodes.forEach((n, i) => {
    const date = n.page.date!;
    if (n.kind === 'weekly') weeklyIdx.set(`${n.page.workspaceLabel}|${date}`, i);
    if (n.kind === 'monthly') monthlyIdx.set(`${n.page.workspaceLabel}|${date.slice(0, 7)}`, i);
  });

  const edges: [number, number][] = [];
  nodes.forEach((n, i) => {
    const date = n.page.date!;
    const ws = n.page.workspaceLabel;
    if (n.kind === 'daily') {
      const w = weeklyIdx.get(`${ws}|${isoWeekEnd(date)}`);
      const m = monthlyIdx.get(`${ws}|${date.slice(0, 7)}`);
      const target = w ?? m;
      if (target !== undefined) edges.push([i, target]);
    } else if (n.kind === 'weekly') {
      const m = monthlyIdx.get(`${ws}|${date.slice(0, 7)}`);
      if (m !== undefined) edges.push([i, m]);
    }
  });

  const neighbors = nodes.map(() => new Set<number>());
  for (const [a, b] of edges) {
    neighbors[a]!.add(b);
    neighbors[b]!.add(a);
  }

  // 초기 배치: 월 클러스터를 원환에 두고 하위 노드를 그 근처에 뿌림 — 시뮬레이션 수렴 가속
  const months = [...new Set(dated.map((p) => p.date!.slice(0, 7)))].sort();
  const monthAngle = new Map(
    months.map((mo, i) => [mo, (i / Math.max(1, months.length)) * Math.PI * 2]),
  );
  nodes.forEach((n, i) => {
    const angle = monthAngle.get(n.page.date!.slice(0, 7)) ?? 0;
    const base = n.kind === 'monthly' ? 190 : n.kind === 'weekly' ? 250 : 310;
    // 결정적 지터(인덱스 기반) — 같은 데이터면 같은 초기 모양
    const j1 = Math.sin(i * 12.9898) * 43758.5453;
    const j2 = Math.sin(i * 78.233) * 12543.8567;
    const jitterA = (j1 - Math.floor(j1) - 0.5) * 0.9;
    const jitterR = (j2 - Math.floor(j2) - 0.5) * 160;
    n.x = Math.cos(angle + jitterA) * (base + jitterR);
    n.y = Math.sin(angle + jitterA) * (base + jitterR);
  });

  return { nodes, edges, neighbors };
}

export function GraphView({
  recent,
  onOpen,
}: {
  recent: RecentListResult | null;
  onOpen: (page: RecentPage) => void;
}) {
  const { t, settings, update } = useSettings();
  const cfg = settings.graph;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  // 슬라이더 조절이 시뮬레이션 재구성 없이 즉시 반영되도록 ref 로 전달
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const kickRef = useRef<() => void>(() => {});
  const [panelOpen, setPanelOpen] = useState(false);
  const pages = recent?.pages;

  useEffect(() => {
    kickRef.current();
  }, [cfg.nodeScale, cfg.spread]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pages || pages.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const graph = buildGraph(pages, cfg.showRollups);
    const { nodes, edges, neighbors } = graph;
    if (nodes.length === 0) return;

    let width = 0;
    let height = 0;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let alpha = 1;
    let hover = -1;
    let dragging: { idx: number } | { pan: true } | null = null;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const scaleOf = (n: GraphNode): number => n.r * cfgRef.current.nodeScale;
    kickRef.current = () => {
      alpha = Math.max(alpha, 0.4);
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    const tick = (): void => {
      const spread = cfgRef.current.spread;
      // 반발(전쌍) + 엣지 스프링 + 중심 인력 — 노드 수백 개 규모라 O(n²) 로 충분
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = (i % 2 ? 1 : -1) * 0.5;
            dy = (j % 2 ? 1 : -1) * 0.5;
            d2 = 0.5;
          }
          const rep = Math.min(12, ((a.r + b.r) * 42 * spread) / d2);
          const inv = 1 / Math.sqrt(d2);
          a.vx += dx * inv * rep;
          a.vy += dy * inv * rep;
          b.vx -= dx * inv * rep;
          b.vy -= dy * inv * rep;
        }
      }
      for (const [ai, bi] of edges) {
        const a = nodes[ai]!;
        const b = nodes[bi]!;
        const rest = (a.kind === 'weekly' || b.kind === 'weekly' ? 55 : 70) * spread;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((dist - rest) / dist) * 0.06;
        a.vx += dx * f;
        a.vy += dy * f;
        b.vx -= dx * f;
        b.vy -= dy * f;
      }
      for (const n of nodes) {
        n.vx -= n.x * 0.0016;
        n.vy -= n.y * 0.0016;
        if (dragging && 'idx' in dragging && nodes[dragging.idx] === n) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx *= 0.86;
        n.vy *= 0.86;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
      }
      alpha = Math.max(0, alpha - 0.004);
    };

    const draw = (): void => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + panX, height / 2 + panY);
      ctx.scale(zoom, zoom);

      for (const [ai, bi] of edges) {
        const a = nodes[ai]!;
        const b = nodes[bi]!;
        const hi = hover !== -1 && (ai === hover || bi === hover);
        ctx.strokeStyle = hi ? EDGE_HI : EDGE_COLOR;
        ctx.lineWidth = (hi ? 1.4 : 0.7) / zoom;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      const dimOthers = hover !== -1;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        const r = scaleOf(n);
        const isHover = i === hover;
        const isNeighbor = hover !== -1 && neighbors[hover]!.has(i);
        const dim = dimOthers && !isHover && !isNeighbor;
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.shadowColor = COLOR[n.kind];
        ctx.shadowBlur = (isHover ? r * 4 : r * 2.2) * zoom;
        ctx.fillStyle = isHover ? '#a5a9ff' : COLOR[n.kind];
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      const labelMode = cfgRef.current.labels;
      const showAll = labelMode === 'always' || (labelMode === 'auto' && zoom > 1.6);
      ctx.textAlign = 'center';
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        const isHover = i === hover;
        const isNeighbor = hover !== -1 && neighbors[hover]!.has(i);
        if (labelMode === 'hover') {
          if (!isHover && !isNeighbor) continue;
        } else {
          if (!(n.kind === 'monthly' || isHover || isNeighbor || showAll)) continue;
          if (hover !== -1 && !isHover && !isNeighbor && n.kind !== 'monthly') continue;
        }
        const size = n.kind === 'monthly' ? 11 : 9.5;
        ctx.font = `500 ${size / zoom}px ${fontFamily}`;
        ctx.fillStyle = isHover ? LABEL_HI : LABEL_COLOR;
        ctx.globalAlpha = hover !== -1 && !isHover && !isNeighbor ? 0.4 : 0.95;
        const label = n.kind === 'daily' ? (n.page.date ?? n.page.title) : n.page.title;
        ctx.fillText(label, n.x, n.y + scaleOf(n) + 14 / zoom);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const loop = (): void => {
      if (alpha > 0.02) tick();
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const toWorld = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - width / 2 - panX) / zoom,
        y: (e.clientY - rect.top - height / 2 - panY) / zoom,
      };
    };
    const hitTest = (e: PointerEvent): number => {
      const { x, y } = toWorld(e);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        const pad = scaleOf(n) + 5 / zoom;
        if ((n.x - x) ** 2 + (n.y - y) ** 2 <= pad * pad) return i;
      }
      return -1;
    };

    const onPointerDown = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId);
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      const hit = hitTest(e);
      dragging = hit !== -1 ? { idx: hit } : { pan: true };
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging) {
        const hit = hitTest(e);
        if (hit !== hover) {
          hover = hit;
          canvas.style.cursor = hit !== -1 ? 'pointer' : 'grab';
        }
        return;
      }
      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      if ('idx' in dragging) {
        const w = toWorld(e);
        const n = nodes[dragging.idx]!;
        n.x = w.x;
        n.y = w.y;
        alpha = Math.max(alpha, 0.3);
      } else {
        panX += e.clientX - lastX;
        panY += e.clientY - lastY;
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerUp = (): void => {
      const wasNode = dragging && 'idx' in dragging ? dragging.idx : -1;
      dragging = null;
      if (wasNode !== -1 && moved < 5) onOpenRef.current(nodes[wasNode]!.page);
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left - width / 2 - panX;
      const cy = e.clientY - rect.top - height / 2 - panY;
      const next = Math.min(3.5, Math.max(0.25, zoom * Math.exp(-e.deltaY * 0.0016)));
      panX -= cx * (next / zoom - 1);
      panY -= cy * (next / zoom - 1);
      zoom = next;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.style.cursor = 'grab';

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [pages, cfg.showRollups]);

  const empty = !pages || pages.filter((p) => p.date !== null).length === 0;
  const setGraph = (patch: Partial<GraphConfig>): void => update({ graph: { ...cfg, ...patch } });

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-canvas">
      {empty ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-[13.5px] text-ink-subtle">{t('graph.empty')}</p>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="h-full w-full [-webkit-app-region:no-drag]" />
          <div className="pointer-events-none absolute left-6 top-0 flex h-20 items-center [-webkit-app-region:drag]">
            <h1 className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
              {t('nav.graph')}
            </h1>
          </div>
          <div className="absolute right-5 top-14 flex flex-col items-end gap-2 [-webkit-app-region:no-drag]">
            <button
              type="button"
              aria-label={t('graph.settings')}
              onClick={() => setPanelOpen((v) => !v)}
              className={[
                'flex size-8 items-center justify-center rounded-lg border border-hairline transition-colors',
                panelOpen
                  ? 'bg-surface-2 text-ink'
                  : 'bg-surface-1 text-ink-subtle hover:bg-surface-2 hover:text-ink',
              ].join(' ')}
            >
              <SlidersHorizontal size={14} strokeWidth={2} />
            </button>
            {panelOpen && (
              <div className="popover-in w-64 rounded-lg border border-hairline bg-surface-1 p-3.5 shadow-xl shadow-black/40 [transform-origin:top_right]">
                <PanelRow label={t('graph.nodeScale')}>
                  <Slider
                    value={cfg.nodeScale}
                    min={0.6}
                    max={1.8}
                    onChange={(v) => setGraph({ nodeScale: v })}
                  />
                </PanelRow>
                <PanelRow label={t('graph.spread')}>
                  <Slider
                    value={cfg.spread}
                    min={0.6}
                    max={2}
                    onChange={(v) => setGraph({ spread: v })}
                  />
                </PanelRow>
                <PanelRow label={t('graph.labels')}>
                  <div className="flex gap-1">
                    {(['auto', 'always', 'hover'] as const).map((mode) => (
                      <LabelChip
                        key={mode}
                        mode={mode}
                        active={cfg.labels === mode}
                        onClick={() => setGraph({ labels: mode })}
                        t={t}
                      />
                    ))}
                  </div>
                </PanelRow>
                <PanelRow label={t('graph.showRollups')}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cfg.showRollups}
                    onClick={() => setGraph({ showRollups: !cfg.showRollups })}
                    className={[
                      'relative h-4.5 w-8 rounded-full transition-colors',
                      cfg.showRollups ? 'bg-accent' : 'bg-surface-3',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute top-0.5 size-3.5 rounded-full bg-white transition-transform',
                        cfg.showRollups ? 'translate-x-4' : 'translate-x-0.5',
                      ].join(' ')}
                    />
                  </button>
                </PanelRow>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute bottom-5 left-6 flex items-center gap-4 text-[11.5px] text-ink-tertiary">
            {(['monthly', 'weekly', 'daily'] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    background: COLOR[k],
                    width: k === 'monthly' ? 9 : k === 'weekly' ? 7 : 5,
                    height: k === 'monthly' ? 9 : k === 'weekly' ? 7 : 5,
                    boxShadow: `0 0 6px ${COLOR[k]}`,
                  }}
                />
                {t(`nav.${k}`)}
              </span>
            ))}
            <span className="text-ink-tertiary/70">{t('graph.hint')}</span>
          </div>
        </>
      )}
    </main>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="shrink-0 text-[12px] text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={0.1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--color-accent)]"
    />
  );
}

const LABEL_MODE_KEY: Record<GraphLabels, I18nKey> = {
  auto: 'graph.labels.auto',
  always: 'graph.labels.always',
  hover: 'graph.labels.hover',
};

function LabelChip({
  mode,
  active,
  onClick,
  t,
}: {
  mode: GraphLabels;
  active: boolean;
  onClick: () => void;
  t: (key: I18nKey) => string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        'rounded-md border px-2 py-1 text-[11.5px] transition-colors',
        active
          ? 'border-accent/50 bg-accent/15 text-ink'
          : 'border-hairline text-ink-subtle hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      {t(LABEL_MODE_KEY[mode])}
    </button>
  );
}
