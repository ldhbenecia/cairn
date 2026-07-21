import { NextResponse } from 'next/server';

// 단순 liveness — DB 접근 없음. 정적/CDN 캐시가 오리진 다운을 가리지 않게 dynamic
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return NextResponse.json({ ok: true });
}
