import { describe, expect, it } from 'vitest';
import { GET as securityTxt } from '@/app/.well-known/security.txt/route';
import { GET as healthcheck } from '@/app/healthz/route';
import { GET as llmsTxt } from '@/app/llms.txt/route';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { GET as sitesJson } from '@/app/sites.json/route';
import { buildStructuredData, publicWorlds, siteIdentity } from '@/data/site';

describe('operational surfaces', () => {
  it('keeps the sitemap local to the canonical origin', () => {
    expect(sitemap()).toEqual([
      {
        url: siteIdentity.origin,
        changeFrequency: 'monthly',
        priority: 1,
      },
    ]);
    expect(robots()).toMatchObject({
      rules: { userAgent: '*', allow: '/' },
      sitemap: `${siteIdentity.origin}/sitemap.xml`,
    });
  });

  it('lists every public world in llms.txt', async () => {
    const body = await llmsTxt().text();
    for (const destination of publicWorlds) {
      expect(body).toContain(`[${destination.name}](${destination.url})`);
    }
    expect(body).toContain('## Owned worlds');
    expect(body).toContain('## Collaborations');
  });

  it('publishes a machine-readable catalog without rendering coordinates', async () => {
    const payload = (await sitesJson().json()) as {
      worlds: Array<Record<string, unknown>>;
    };
    expect(payload.worlds).toHaveLength(publicWorlds.length);
    expect(payload.worlds[0]).not.toHaveProperty('angle');
    expect(payload.worlds[0]).not.toHaveProperty('color');
    expect(
      payload.worlds.find(({ id }) => id === 'android-hell'),
    ).toMatchObject({
      relationship: 'owned',
      hosting: 'first-party',
      status: 'live',
    });
  });

  it('keeps structured data synchronized with the catalog', () => {
    const graph = buildStructuredData()['@graph'] as Array<
      Record<string, unknown>
    >;
    const itemList = graph.find((entry) => entry['@type'] === 'ItemList');
    expect(itemList).toMatchObject({ numberOfItems: publicWorlds.length });
  });

  it('answers health checks without caching them', async () => {
    const response = healthcheck();
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'alirezas-galaxy',
    });
  });

  it('warns well before security.txt expires', async () => {
    const response = securityTxt();
    const body = await response.text();
    const expiry = body.match(/^Expires: (.+)$/m)?.[1];
    expect(expiry).toBeTruthy();
    expect(Date.parse(expiry!) - Date.now()).toBeGreaterThan(
      1000 * 60 * 60 * 24 * 180,
    );
    expect(body).toContain(
      `Canonical: ${siteIdentity.origin}/.well-known/security.txt`,
    );
  });
});
