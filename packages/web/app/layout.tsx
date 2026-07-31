import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';

import { REPO_URL } from '../lib/github';
import { SITE_URL } from '../lib/site';

const serif = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'opsz'],
  variable: '--font-serif-display',
});

const TITLE = 'Cairn — your daily dev work, stacked into a worklog';
const DESC =
  'cairn collects your GitHub PRs and commits, summarizes them with Claude, and writes a daily worklog to a local Markdown journal — publish to Notion and more with integrations.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Cairn' },
  description: DESC,
  applicationName: 'Cairn',
  keywords: [
    'developer worklog',
    'dev journal',
    'GitHub activity',
    'local-first',
    'Notion',
    'Claude',
    'standup notes',
    'work journal',
    'work log automation',
    '개발 일지',
    '자동 작업 일지',
  ],
  authors: [{ name: 'ldhbenecia', url: REPO_URL }],
  creator: 'ldhbenecia',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Cairn',
    title: TITLE,
    description: DESC,
    locale: 'en_US',
    alternateLocale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '1024x1024' },
    ],
    apple: '/icon.png',
  },
};

// 구글 '사이트 이름'(검색 결과 브랜드 표기)은 WebSite 구조화 데이터를 1차 신호로 쓴다
const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Cairn',
  alternateName: ['cairn', 'cairnlog'],
  url: SITE_URL,
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cairn',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS',
  description: DESC,
  url: SITE_URL,
  downloadUrl: `${REPO_URL}/releases/latest`,
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'ldhbenecia', url: REPO_URL },
};

import { LangAttr } from './lang-attr';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // lang 은 LangAttr 가 클라이언트에서 경로 기준 동기화 (headers() 사용 시 전 라우트 동적화)
  return (
    <html lang="en" suppressHydrationWarning className={serif.variable}>
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        <LangAttr />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
