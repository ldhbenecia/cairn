'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function LangAttr() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = pathname === '/ko' || pathname.startsWith('/ko/') ? 'ko' : 'en';
  }, [pathname]);
  return null;
}
