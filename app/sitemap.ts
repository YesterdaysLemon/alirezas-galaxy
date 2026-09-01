import type { MetadataRoute } from 'next';
import { siteIdentity } from '@/data/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteIdentity.origin,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
