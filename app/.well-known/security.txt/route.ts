import { siteIdentity } from '../../../data/site';

export function GET() {
  const canonical = `${siteIdentity.origin}/.well-known/security.txt`;
  const body = [
    `Contact: mailto:${siteIdentity.email}`,
    `Canonical: ${canonical}`,
    'Preferred-Languages: en',
    'Expires: 2027-09-01T00:00:00.000Z',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
