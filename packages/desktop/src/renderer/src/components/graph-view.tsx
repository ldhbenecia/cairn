import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphConfig, GraphLabels, RecentListResult, RecentPage } from '../cairn-api';
import { ACCENTS, useSettings } from '../settings-context';
import type { I18nKey } from '../i18n';
import { Toggle } from './toggle';

type Kind = 'daily' | 'weekly' | 'monthly';

type GraphNode = {
  page: RecentPage;
  kind: Kind;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // 수렴 후 '행성처럼' 계속 떠다니는 gentle float 용 — 정착 위치(hx,hy)를 중심으로 사인 드리프트
  hx: number;
  hy: number;
  phase: number;
};

type Graph = { nodes: GraphNode[]; edges: [number, number][]; neighbors: Set<number>[] };

const EDGE_COLOR = 'rgba(98, 102, 109, 0.28)';

const LEGEND_CSS: Record<Kind, string> = {
  daily: 'var(--color-ink-subtle)',
  weekly: 'color-mix(in srgb, var(--color-accent) 62%, white)',
  monthly: 'var(--color-accent)',
};

// canvas 는 var() 를 못 쓰므로 ink 계열만 probe 로 해석 (테마 의존)
function resolveColor(css: string): string {
  const probe = document.createElement('span');
  probe.style.color = css;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return rgb || css;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixWithWhite(hex: string, keep: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (c: number): number => Math.round(c * keep + 255 * (1 - keep));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

type Palette = {
  node: Record<Kind, string>;
  edgeHi: string;
  hoverFill: string;
  label: string;
  labelHi: string;
};

// 강조색은 설정값(hex)에서 직접 파생 — CSS 변수 갱신 타이밍과 무관하게 즉시 반영
function buildPalette(accentId: string): Palette {
  const accent = ACCENTS.find((a) => a.id === accentId)?.color ?? '#5b61e6';
  const [r, g, b] = hexToRgb(accent);
  return {
    node: {
      daily: resolveColor('var(--color-ink-subtle)'),
      weekly: mixWithWhite(accent, 0.62),
      monthly: accent,
    },
    edgeHi: `rgba(${r}, ${g}, ${b}, 0.75)`,
    hoverFill: mixWithWhite(accent, 0.45),
    label: resolveColor('var(--color-ink-subtle)'),
    labelHi: resolveColor('var(--color-ink)'),
  };
}

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
  const nodes: GraphNode[] = dated.map((page, i) => {
    const kind = page.category;
    const activity = (page.pr ?? 0) + (page.commit ?? 0);
    const r =
      kind === 'monthly'
        ? 15
        : kind === 'weekly'
          ? 9
          : 3.5 + Math.min(5, Math.sqrt(activity) * 1.4);
    // phase: 인덱스 기반(결정적) — 노드마다 드리프트 위상을 흩어 동시에 같은 방향으로 안 흐르게
    return { page, kind, r, x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, phase: i * 1.7 };
  });

  const weeklyIdx = new Map<string, number>();
  const monthlyIdx = new Map<string, number>();
  nodes.forEach((n, i) => {
    const date = n.page.date!;
    // 노션 weekly 는 일요일, 로컬 journal weekly 는 월요일 날짜 — isoWeekEnd 로 같은 키로 정규화
    if (n.kind === 'weekly') weeklyIdx.set(`${n.page.workspaceLabel}|${isoWeekEnd(date)}`, i);
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

  // 초기 배치: 각 월을 원환 위 '클러스터 중심'에 두고, 같은 달 노드를 그 중심 근처에 compact
  // blob 으로 흩뿌린다(반경별 동심원 링 X). 링으로 뿌리면 스프링이 같은 달 노드를 반경선 따라
  // 뭉치며 진입 순간 눈에 띄게 '오므라들어' 이상해짐 — blob 시드는 수렴 형태(월별 blob)에 가까워
  // 그 수축을 없앤다. clusterR 은 월 개수에 맞춰 클러스터가 겹치지 않게 스케일.
  const months = [...new Set(dated.map((p) => p.date!.slice(0, 7)))].sort();
  const m = months.length;
  // 클러스터 원환 반경 — 월 개수에 맞춰 이웃 클러스터가 겹치지 않게(수렴 위치에 근접해 전역 수축 최소화)
  const clusterR = m <= 1 ? 0 : Math.max(190, Math.min(480, 140 / Math.sin(Math.PI / m)));
  const monthAngle = new Map(months.map((mo, i) => [mo, (i / m) * Math.PI * 2]));
  nodes.forEach((n, i) => {
    const angle = monthAngle.get(n.page.date!.slice(0, 7)) ?? 0;
    const cx = Math.cos(angle) * clusterR;
    const cy = Math.sin(angle) * clusterR;
    // 결정적 스캐터(인덱스 해시) — 같은 데이터면 같은 초기 모양. monthly 는 중심 가까이, daily 는
    // 조금 더 퍼지게(반경 링이 아닌 blob)
    const j1 = Math.sin(i * 12.9898) * 43758.5453;
    const j2 = Math.sin(i * 78.233) * 12543.8567;
    const sx = j1 - Math.floor(j1) - 0.5;
    const sy = j2 - Math.floor(j2) - 0.5;
    const spread = n.kind === 'monthly' ? 20 : n.kind === 'weekly' ? 54 : 84;
    n.x = cx + sx * spread;
    n.y = cy + sy * spread;
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
  const accentRef = useRef(settings.accent);
  accentRef.current = settings.accent;
  const themeRef = useRef(settings.theme);
  themeRef.current = settings.theme;
  const kickRef = useRef<() => void>(() => {});
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState('');
  const queryRef = useRef('');
  queryRef.current = query.trim().toLowerCase();
  // 레이아웃에 영향 주는 설정(간격·중력 등)이 바뀌면 물리를 다시 돌려 재배치.
  // 테마·검색어는 루프가 매 프레임 반영하므로(연속 실행) wake 불필요 — 검색 중 그래프가 들썩이지 않게.
  const wakeRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    wakeRef.current?.();
  }, [cfg]);
  // 유휴(rAF 정지) 중에도 테마·강조색·검색어가 바뀌면 단발 재드로로 반영 — 레이아웃은 불변
  const redrawRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    redrawRef.current?.();
  }, [settings.theme, settings.accent, query]);
  const pages = recent?.pages;
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  // 백그라운드 목록 갱신(포커스 재조회 등)마다 배열 참조가 바뀌어도 내용이 같으면 재구성하지 않고,
  // 재구성하더라도 카메라·기존 노드 위치는 이어받는다
  const signature = useMemo(
    () => (pages ?? []).map((p) => `${p.pageId}:${p.pr}:${p.commit}:${p.date}`).join('|'),
    [pages],
  );
  const cameraRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const posRef = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    kickRef.current();
  }, [cfg.nodeScale, cfg.spread, cfg.gravity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pages = pagesRef.current;
    if (!canvas || !pages || pages.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const graph = buildGraph(pages, cfg.showRollups);
    const { nodes, edges, neighbors } = graph;
    if (nodes.length === 0) return;

    let seeded = 0;
    for (const n of nodes) {
      const prev = posRef.current.get(n.page.pageId);
      if (prev) {
        n.x = prev.x;
        n.y = prev.y;
        seeded += 1;
      }
    }

    let width = 0;
    let height = 0;
    let { zoom, panX, panY } = cameraRef.current;
    // 첫 진입은 부드럽게 정착하도록 낮은 alpha(과거 1 은 스텝이 커 '확 움직이고 멈춤'), 위치 복원 시 미세 재정착
    let alpha = seeded === nodes.length ? 0.1 : 0.55;
    let hover = -1;
    let dragging: { idx: number } | { pan: true } | null = null;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    let settled = false; // 물리 수렴 완료 여부
    let drift = 0; // 드리프트 진폭 예산(1→0). 수렴 후 서서히 감쇠해 완전 정지 → rAF 도 멈춰 유휴 비용 0
    let tf = 0; // 드리프트 시간 카운터 (프레임당 증가)
    const DRIFT_AMP = 5.5; // 드리프트 최대 진폭(px) — 행성처럼 눈에 띄게 부유
    const fontFamily = getComputedStyle(document.body).fontFamily;
    let palette = buildPalette(accentRef.current);
    let paletteKey = `${accentRef.current}|${themeRef.current}`;
    // 테마 전환은 CSS 변수(ink 계열) 반영 후에 읽어야 해서 한 프레임 지연 후 재생성
    let pendingKey: string | null = null;
    const scaleOf = (n: GraphNode): number => n.r * cfgRef.current.nodeScale;
    kickRef.current = () => {
      alpha = Math.max(alpha, 0.4);
      settled = false;
      ensureLoop();
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
      const pull = 0.0016 * cfgRef.current.gravity;
      for (const n of nodes) {
        n.vx -= n.x * pull;
        n.vy -= n.y * pull;
        if (dragging && 'idx' in dragging && nodes[dragging.idx] === n) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        // 감쇠 완화(과거 0.86 은 속도를 ~0.3s 만에 죽여 '확 움직이고 굳음'). alpha 감쇠와 보조를
        // 맞춰 속도가 함께 사그라들며 부드럽게 정착
        n.vx *= 0.9;
        n.vy *= 0.9;
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
        ctx.strokeStyle = hi ? palette.edgeHi : EDGE_COLOR;
        ctx.lineWidth = (hi ? 1.4 : 0.7) / zoom;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      const q = queryRef.current;
      const matches = (n: GraphNode): boolean =>
        q.length === 0 || n.page.title.toLowerCase().includes(q) || (n.page.date ?? '').includes(q);
      const dimOthers = hover !== -1;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        const r = scaleOf(n);
        const isHover = i === hover;
        const isNeighbor = hover !== -1 && neighbors[hover]!.has(i);
        const dim = (dimOthers && !isHover && !isNeighbor) || (!isHover && !matches(n));
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.shadowColor = palette.node[n.kind];
        // glow 축소 — 과거 r*2.2 는 밀집 클러스터에서 halo 가 겹쳐 '뽀얀' 안개가 됨. 노드를 또렷하게
        ctx.shadowBlur = (isHover ? r * 2.4 : r * 1.1) * zoom;
        ctx.fillStyle = isHover ? palette.hoverFill : palette.node[n.kind];
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
        const searchHit = q.length > 0 && matches(n);
        if (labelMode === 'hover') {
          if (!isHover && !isNeighbor && !searchHit) continue;
        } else if (!searchHit) {
          if (!(n.kind === 'monthly' || isHover || isNeighbor || showAll)) continue;
          if (hover !== -1 && !isHover && !isNeighbor && n.kind !== 'monthly') continue;
        }
        if (q.length > 0 && !matches(n)) continue;
        const size = n.kind === 'monthly' ? 11 : 9.5;
        ctx.font = `500 ${size / zoom}px ${fontFamily}`;
        ctx.fillStyle = isHover ? palette.labelHi : palette.label;
        ctx.globalAlpha = hover !== -1 && !isHover && !isNeighbor ? 0.4 : 0.95;
        const label = n.kind === 'daily' ? (n.page.date ?? n.page.title) : n.page.title;
        ctx.fillText(label, n.x, n.y + scaleOf(n) + 14 / zoom);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const loop = (): void => {
      const key = `${accentRef.current}|${themeRef.current}`;
      if (key !== paletteKey) {
        if (pendingKey === key) {
          palette = buildPalette(accentRef.current);
          paletteKey = key;
          pendingKey = null;
        } else {
          pendingKey = key;
        }
      } else {
        pendingKey = null;
      }
      // 물리는 수렴 전 or '노드' 드래그 중에만. 패닝({pan})은 물리를 건드리지 않는다 —
      // 패닝이 물리로 전환하면 드리프트 앵커가 재캡처되며 클릭마다 노드가 딱딱 튐(staccato)
      const nodeDrag = dragging !== null && 'idx' in dragging;
      if (alpha > 0.02 || nodeDrag) {
        // 레이아웃 단계 — 수렴할 때까지 O(n²)
        tick();
        settled = false;
        drift = 1; // 수렴 후 쓸 드리프트 예산을 채워둠
      } else {
        // 수렴 완료 → 드리프트 진폭을 서서히 0 으로(ease-out) 감쇠하며 완전히 멈춤.
        // 앵커는 드리프트 offset 을 뺀 순수 정착 위치로 캡처 → 재진입해도 불연속 없음
        if (!settled) {
          for (const n of nodes) {
            n.hx = n.x - Math.sin(tf * 0.02 + n.phase) * DRIFT_AMP * drift;
            n.hy = n.y - Math.cos(tf * 0.016 + n.phase * 1.3) * DRIFT_AMP * drift;
          }
          settled = true;
        }
        if (drift > 0) {
          tf += 1;
          drift = Math.max(0, drift - 0.004); // ≈4s 에 걸쳐 눈에 띄게 부유하다 서서히 멈춤
          const A = DRIFT_AMP * drift; // 진폭이 선형으로 줄며 부드럽게 멈춤
          for (const n of nodes) {
            n.x = n.hx + Math.sin(tf * 0.02 + n.phase) * A;
            n.y = n.hy + Math.cos(tf * 0.016 + n.phase * 1.3) * A;
          }
        }
      }
      draw();
      // 움직임(수렴·노드드래그·드리프트)·패닝/줌·팔레트 스왑 대기가 있을 때만 계속.
      // 완전 정지하면 rAF 도 멈춰 유휴 비용 0 (검색·테마·줌은 redraw/ensureLoop 로 단발 재개)
      const animating = alpha > 0.02 || nodeDrag || drift > 0;
      if (animating || dragging !== null || pendingKey !== null) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };
    const ensureLoop = (): void => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };
    // 레이아웃에 영향 주는 설정 변경 시: 물리를 짧게 재개해 재배치 후 다시 정지
    const wake = (): void => {
      alpha = Math.max(alpha, 0.4);
      settled = false;
      drift = 1;
      ensureLoop();
    };
    wakeRef.current = wake;
    // 테마·강조색·검색어 변경 시: 레이아웃은 그대로, 단발 재드로만(유휴 정지 상태에서도 반영)
    redrawRef.current = ensureLoop;

    // 진입 '오므라듦' 제거 — 첫 프레임 전에 물리를 오프스크린으로 수렴시킨다. 수렴 과정(수축/재배치)을
    // 화면에 안 보여주고 정착된 레이아웃이 바로 나타난 뒤 gentle drift 만 재생. 최대 300틱 O(n²) 라
    // 최초 진입 시 짧은 계산뿐. 재진입(위치 복원)은 alpha 가 낮아 몇 틱만 돌아 저장 위치를 유지.
    if (seeded < nodes.length) alpha = 1;
    for (let it = 0; it < 300 && alpha > 0.02; it++) tick();
    drift = 1; // 표시 단계에선 물리 없이 gentle drift 만
    raf = requestAnimationFrame(loop);

    const toWorld = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - width / 2 - panX) / zoom,
        y: (e.clientY - rect.top - height / 2 - panY) / zoom,
      };
    };
    // pad: 히트 반경 여유(px). 커서/hover 는 0(노드 위에서만 포인터), 클릭/드래그는 5(작은 노드도
    // 잡기 쉽게). 밀집 클러스터에서 +5 여유가 노드 사이 빈틈까지 잡아 커서가 상시 포인터로 뜨던 문제 해소
    const hitTest = (e: PointerEvent, pad = 5): number => {
      const { x, y } = toWorld(e);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]!;
        const reach = scaleOf(n) + pad / zoom;
        if ((n.x - x) ** 2 + (n.y - y) ** 2 <= reach * reach) return i;
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
      ensureLoop(); // 유휴 중이면 드래그/패닝 프레임을 위해 재개
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (!dragging) {
        const hit = hitTest(e, 0); // 커서/하이라이트는 노드 위에서만(빈틈 여유 없음)
        if (hit !== hover) {
          hover = hit;
          canvas.style.cursor = hit !== -1 ? 'pointer' : 'grab';
          ensureLoop(); // hover 하이라이트 갱신을 위한 단발 재드로
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
      ensureLoop(); // 줌 갱신 재드로
    };

    const onPointerLeave = (): void => {
      if (dragging) return;
      if (hover !== -1) {
        hover = -1;
        canvas.style.cursor = 'grab';
        ensureLoop(); // hover 해제 재드로
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.style.cursor = 'grab';

    return () => {
      wakeRef.current = null;
      cameraRef.current = { zoom, panX, panY };
      for (const n of nodes) posRef.current.set(n.page.pageId, { x: n.x, y: n.y });
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [signature, cfg.showRollups]);

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
          {/* 상단 80px 풀폭 드래그 밴드 — 창 이동 핸들(대시보드·일지 뷰와 동일 패턴).
              캔버스가 no-drag 로 상단을 덮어 제목 폭만 잡히던 문제 해소. 우측 컨트롤은 no-drag 상위 형제라 클릭 유지 */}
          <div className="absolute inset-x-0 top-0 flex h-20 items-center px-6 [-webkit-app-region:drag]">
            <h1 className="text-[15px] font-semibold tracking-[-0.2px] text-ink">
              {t('nav.graph')}
            </h1>
          </div>
          <div className="absolute right-5 top-14 flex flex-col items-end gap-2 [-webkit-app-region:no-drag]">
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon
                  size={12}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('graph.search')}
                  spellCheck={false}
                  className="h-8 w-44 rounded-lg border border-hairline bg-surface-1 pl-7 pr-2 text-[12px] text-ink placeholder:text-ink-tertiary"
                />
              </div>
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
            </div>
            {panelOpen && (
              <div className="popover-in w-64 rounded-lg border border-hairline bg-surface-1 p-3.5 shadow-xl shadow-black/40 [transform-origin:top_right]">
                <PanelRow label={t('graph.nodeScale')}>
                  <Slider
                    value={cfg.nodeScale}
                    min={0.7}
                    max={1.3}
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
                <PanelRow label={t('graph.gravity')}>
                  <Slider
                    value={cfg.gravity}
                    min={0.3}
                    max={2}
                    onChange={(v) => setGraph({ gravity: v })}
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
                  <Toggle
                    checked={cfg.showRollups}
                    onChange={(v) => setGraph({ showRollups: v })}
                  />
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
                    background: LEGEND_CSS[k],
                    width: k === 'monthly' ? 9 : k === 'weekly' ? 7 : 5,
                    height: k === 'monthly' ? 9 : k === 'weekly' ? 7 : 5,
                    boxShadow: `0 0 6px ${LEGEND_CSS[k]}`,
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
