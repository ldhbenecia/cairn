'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// <html lang> 을 클라이언트에서 경로 기준으로 동기화 — 루트 레이아웃의 headers() 판별을
// 대체한다. headers() 는 전 라우트를 동적 렌더로 강제해 로케일 전환마다 서버 왕복이 생겼다
export function LangAttr() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = pathname === '/ko' || pathname.startsWith('/ko/') ? 'ko' : 'en';
  }, [pathname]);
  return null;
}
