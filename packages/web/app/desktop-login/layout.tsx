import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// OAuth 브리지 유틸리티 페이지 — 검색 색인 대상 아님 (port 없이 도달하면 막다른 페이지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DesktopLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
