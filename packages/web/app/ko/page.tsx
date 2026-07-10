import type { Metadata } from 'next';

import { Landing } from '../../components/landing';

const TITLE = 'cairn — 매일의 개발 작업을, 쌓이는 개발 일지로';
const DESC =
  'cairn 은 GitHub PR·커밋을 모아 Claude 로 요약하고, 로컬 마크다운 일지로 매일 기록합니다 — Notion 등 연동 발행은 선택입니다.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: {
    canonical: '/ko',
    languages: { en: '/', ko: '/ko' },
  },
  openGraph: {
    url: '/ko',
    title: TITLE,
    description: DESC,
    locale: 'ko_KR',
    alternateLocale: 'en_US',
  },
  twitter: { title: TITLE, description: DESC },
};

export const revalidate = 3600;

export default function HomeKo() {
  return <Landing lang="ko" />;
}
