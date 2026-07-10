import './globals.css';

import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { REPO_URL } from '../lib/github';
import { SITE_URL } from '../lib/site';

const TITLE = 'cairn — your daily dev work, stacked into a worklog';
const DESC =
  'cairn collects your GitHub PRs and commits, summarizes them with Claude, and writes a daily worklog to a local Markdown journal — publish to Notion and more with integrations.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · cairn' },
  description: DESC,
  applicationName: 'cairn',
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
    siteName: 'cairn',
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

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'cairn',
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const lang = pathname.startsWith('/ko') ? 'ko' : 'en';
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
