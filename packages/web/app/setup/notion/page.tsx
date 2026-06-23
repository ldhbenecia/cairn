import type { Metadata } from 'next';

import { NotionGuide } from '../../../components/notion-guide';

const TITLE = 'Connect Notion — cairn setup';
const DESC = 'Set up a Notion integration so cairn can publish your daily worklogs.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: {
    canonical: '/setup/notion',
    languages: { en: '/setup/notion', ko: '/ko/setup/notion' },
  },
  openGraph: { url: '/setup/notion', title: TITLE, description: DESC },
};

export const revalidate = 3600;

export default function SetupNotion() {
  return <NotionGuide lang="en" />;
}
