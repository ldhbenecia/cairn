import type { Metadata } from 'next';

import { Landing } from '../components/landing';

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
