import type { Metadata } from 'next';

import { NotionGuide } from '../../../../components/notion-guide';

const TITLE = 'Notion 연결 가이드 — cairn 셋업';
const DESC = 'cairn 이 매일 작업 일지를 발행할 수 있도록 Notion integration 을 연결하는 방법.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: {
    canonical: '/ko/setup/notion',
    languages: { en: '/setup/notion', ko: '/ko/setup/notion' },
  },
  openGraph: { url: '/ko/setup/notion', title: TITLE, description: DESC, locale: 'ko_KR' },
};

export const revalidate = 3600;

export default function SetupNotionKo() {
  return <NotionGuide lang="ko" />;
}
