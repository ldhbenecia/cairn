import { eq, sql } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { worklogStats } from '@/lib/schema';

const CATEGORIES = new Set(['daily', 'weekly', 'monthly']);

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

// 화이트리스트 검증 — 집계 수치만. 코드/경로/토큰 등은 스키마에 자리조차 없음(ADR 0003/0028).
function parseRows(input: unknown): StatRow[] | null {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { stats?: unknown }).stats)) {
    return null;
  }
  const rows: StatRow[] = [];
  for (const r of (input as { stats: unknown[] }).stats) {
    if (!r || typeof r !== 'object') return null;
    const o = r as Record<string, unknown>;
    if (typeof o.category !== 'string' || !CATEGORIES.has(o.category)) return null;
    if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null;
    if (!Number.isInteger(o.pr) || (o.pr as number) < 0) return null;
    if (!Number.isInteger(o.commitCount) || (o.commitCount as number) < 0) return null;
    if (!Array.isArray(o.hours) || o.hours.some((h) => !Number.isInteger(h) || (h as number) < 0))
      return null;
    if (typeof o.updatedAt !== 'string' || Number.isNaN(Date.parse(o.updatedAt))) return null;
    rows.push({
      category: o.category,
      date: o.date,
      pr: o.pr as number,
      commitCount: o.commitCount as number,
      hours: o.hours as number[],
      updatedAt: o.updatedAt,
    });
  }
  return rows;
}

export async function GET(req: NextRequest): Promise<Response> {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await db.select().from(worklogStats).where(eq(worklogStats.userId, uid));
  return NextResponse.json({ stats: rows });
}

export async function POST(req: NextRequest): Promise<Response> {
  const uid = await getUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = parseRows(await req.json().catch(() => null));
  if (!rows) return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  if (rows.length === 0) return NextResponse.json({ upserted: 0 });
  // 일/주/월 집계라 한 번에 수천 개를 넘을 이유가 없음 — 메모리·파라미터 폭주 방어.
  if (rows.length > 1000) return NextResponse.json({ error: 'payload-too-large' }, { status: 413 });

  // LWW: 들어온 updated_at 이 더 최신일 때만 덮어쓴다.
  await db
    .insert(worklogStats)
    .values(
      rows.map((r) => ({
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

  return NextResponse.json({ upserted: rows.length });
}
