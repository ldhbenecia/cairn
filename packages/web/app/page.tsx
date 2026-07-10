import type { Metadata } from 'next';

import { Landing } from '../components/landing';

// canonical 은 페이지 단위 — 루트 layout 에 두면 /privacy·/terms 등이 홈을 canonical 로 상속한다
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
    languages: { en: '/', ko: '/ko' },
  },
};

export const revalidate = 3600;

export default function Home() {
  return <Landing lang="en" />;
}
