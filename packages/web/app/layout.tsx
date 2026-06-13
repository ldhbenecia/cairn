import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'cairn — your daily dev work, as a Notion worklog';
const DESC =
  'cairn collects your GitHub PRs and commits, summarizes them with Claude, and publishes a daily worklog to Notion — raw material for your resume, reviews, and salary talks.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: {
    title: 'cairn — automatic dev worklog',
    description: 'GitHub activity → Claude summary → Notion worklog. Built for resume & review prep.',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
