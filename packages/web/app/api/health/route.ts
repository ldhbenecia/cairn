import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return NextResponse.json({ ok: true });
}
