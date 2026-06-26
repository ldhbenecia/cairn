import { type NextRequest, NextResponse } from 'next/server';

// 루트 레이아웃이 locale 별 <html lang> 을 방출하도록 현재 경로를 요청 헤더로 전달한다.
export function middleware(req: NextRequest): NextResponse {
  const headers = new Headers(req.headers);
  headers.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
