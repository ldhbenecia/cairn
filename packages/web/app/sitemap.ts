import type { MetadataRoute } from 'next';

import { SITE_URL } from '../lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: { languages: { en: SITE_URL, ko: `${SITE_URL}/ko` } },
    },
    {
      url: `${SITE_URL}/ko`,
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: { languages: { en: SITE_URL, ko: `${SITE_URL}/ko` } },
    },
    {
      url: `${SITE_URL}/setup/notion`,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: { en: `${SITE_URL}/setup/notion`, ko: `${SITE_URL}/ko/setup/notion` },
      },
    },
    {
      url: `${SITE_URL}/ko/setup/notion`,
      changeFrequency: 'monthly',
      priority: 0.5,
      alternates: {
        languages: { en: `${SITE_URL}/setup/notion`, ko: `${SITE_URL}/ko/setup/notion` },
      },
    },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/ko/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
