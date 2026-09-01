import type { MetadataRoute } from 'next';
import { siteIdentity } from '@/data/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${siteIdentity.origin}/sitemap.xml`,
    host: siteIdentity.origin,
  };
}
