import type { Metadata } from 'next';

import { Pricing } from '../../components/pricing';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'cairn is free and open source. Pro unlocks power features with a one-time purchase.',
  alternates: {
    canonical: '/pricing',
    languages: { en: '/pricing', ko: '/ko/pricing' },
  },
};

export const revalidate = 3600;

export default function PricingPage() {
  return <Pricing lang="en" />;
}
