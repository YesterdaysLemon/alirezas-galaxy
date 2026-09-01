import { serializeWorlds, siteIdentity } from '@/data/site';

export function GET() {
  return Response.json(
    {
      name: siteIdentity.name,
      owner: siteIdentity.owner,
      canonicalUrl: siteIdentity.origin,
      worlds: serializeWorlds(),
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    },
  );
}
