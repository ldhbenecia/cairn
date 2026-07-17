import type { Metadata } from 'next';

import { Pricing } from '../../../components/pricing';

export const metadata: Metadata = {
  title: '요금제',
  description: 'cairn 은 무료 오픈소스입니다. Pro 는 일회성 구매로 파워 기능을 엽니다.',
  alternates: {
    canonical: '/ko/pricing',
    languages: { en: '/pricing', ko: '/ko/pricing' },
  },
};

export const revalidate = 3600;

export default function PricingPageKo() {
  return <Pricing lang="ko" />;
}
