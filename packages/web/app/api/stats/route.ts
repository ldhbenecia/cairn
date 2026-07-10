import { eq, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { worklogStats } from '@/lib/schema';

const CATEGORIES = new Set(['daily', 'weekly', 'monthly']);
const MAX_COUNT = 100_000; // int4 overflow·과대값 차단 (도메인 상한)
const HOURS_LEN = 24;
const ISO_8601_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

type StatRow = {
  category: string;
  date: string;
  pr: number;
  commitCount: number;
  hours: number[];
  updatedAt: string;
};

async function getUserId(req: NextRequest): Promise<string | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user.id ?? null;
}

// 달력상 실재하는 날짜인지(2026-13-45 같은 형식만 맞는 값 차단)
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// 화이트리스트 검증 — 집계 수치만, 코드/경로/토큰은 스키마에 자리조차 없음(ADR 0003/0029)
function parseRows(input: unknown): StatRow[] | null {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { stats?: unknown }).stats)) {
    return null;
  }
  const rows: StatRow[] = [];
  for (const r of (input as { stats: unknown[] }).stats) {
    if (!r || typeof r !== 'object') return null;
    const o = r as Record<string, unknown>;
    if (typeof o.category !== 'string' || !CATEGORIES.has(o.category)) return null;
    if (typeof o.date !== 'string' || !isValidDate(o.date)) return null;
    if (!Number.isInteger(o.pr) || (o.pr as number) < 0 || (o.pr as number) > MAX_COUNT)
      return null;
    if (
      !Number.isInteger(o.commitCount) ||
      (o.commitCount as number) < 0 ||
      (o.commitCount as number) > MAX_COUNT
    )
      return null;
    // 시간대 히스토그램은 24칸 고정 — 길이 상한으로 메모리 폭주 차단, 음수·과대값 차단
    if (!Array.isArray(o.hours) || o.hours.length > HOURS_LEN) return null;
    if (o.hours.some((h) => !Number.isInteger(h) || (h as number) < 0 || (h as number) > MAX_COUNT))
      return null;
    if (typeof o.updatedAt !== 'string' || !ISO_8601_OFFSET.test(o.updatedAt)) return null;
    const updatedTs = Date.parse(o.updatedAt);
    if (Number.isNaN(updatedTs) || updatedTs > Date.now() + 86_400_000) return null;
    // reader 가 hours[0..23] 인덱싱하므로 정확히 24칸 보장(부족분 0 패딩)
    const hours = o.hours as number[];
    const normalizedHours =
      hours.length === HOURS_LEN
        ? hours
        : Array.from({ length: HOURS_LEN }, (_, i) => hours[i] ?? 0);
    rows.push({
      category: o.category,
      date: o.date,
      pr: o.pr as number,
      commitCount: o.commitCount as number,
      hours: normalizedHours,
      updatedAt: o.updatedAt,
    });
  }
  return rows;
}

// 드라이버가 DATE 를 JS Date(서버 로컬 자정)로 줄 때의 방어 — 로컬 getter 로 되돌리면
// 서버 타임존과 무관하게 원래 달력 날짜가 보존된다 (toISOString 은 UTC 변환이라 금지)
function dateToIso(v: unknown): unknown {
  if (!(v instanceof Date)) return v;
  const mm = String(v.getMonth() + 1).padStart(2, '0');
  const dd = String(v.getDate()).padStart(2, '0');
  return `${v.getFullYear()}-${mm}-${dd}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await db.select().from(worklogStats).where(eq(worklogStats.userId, uid));
  return NextResponse.json({ stats: rows.map((r) => ({ ...r, date: dateToIso(r.date) })) });
}

export async function POST(req: NextRequest): Promise<Response> {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  // parseRows 가 항목마다 정규식·Date 검증을 하므로, 대용량 배열은 검증 전에 길이로 먼저 차단(DoS 방어)
  const stats = (body as { stats?: unknown } | null)?.stats;
  if (!Array.isArray(stats)) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  if (stats.length > 1000)
    return NextResponse.json({ error: 'payload-too-large' }, { status: 413 });

  const rows = parseRows(body);
  if (!rows) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ upserted: 0 });

  // 같은 (category,date) 가 한 배치에 두 번 오면 ON CONFLICT 가 같은 행을 두 번 못 건드려
  // Postgres 21000 → 500 이 되던 문제 — 최신 updatedAt 만 남긴다
  const byKey = new Map<string, StatRow>();
  for (const r of rows) {
    const k = `${r.category}:${r.date}`;
    const prev = byKey.get(k);
    if (!prev || Date.parse(r.updatedAt) >= Date.parse(prev.updatedAt)) byKey.set(k, r);
  }
  const deduped = [...byKey.values()];

  // LWW — 들어온 updated_at 이 더 최신일 때만 덮어씀
  await db
    .insert(worklogStats)
    .values(
      deduped.map((r) => ({
        userId: uid,
        category: r.category,
        date: r.date,
        pr: r.pr,
        commitCount: r.commitCount,
        hours: r.hours,
        updatedAt: new Date(r.updatedAt),
      })),
    )
    .onConflictDoUpdate({
      target: [worklogStats.userId, worklogStats.category, worklogStats.date],
      set: {
        pr: sql`excluded.pr`,
        commitCount: sql`excluded.commit_count`,
        hours: sql`excluded.hours`,
        updatedAt: sql`excluded.updated_at`,
      },
      setWhere: sql`${worklogStats.updatedAt} < excluded.updated_at`,
    });

  return NextResponse.json({ upserted: deduped.length });
}
