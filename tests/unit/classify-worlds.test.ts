import { describe, expect, it } from 'vitest';
import {
  classifyNewWorlds,
  decide,
  JEV_ENDPOINT,
  JEV_MODEL,
  nextSlot,
  validateChoice,
} from '../../scripts/classify-worlds.mjs';
import familyData from '@/data/families.json';
import { MAX_ACTIVE_FAMILIES, parseSystemRoute } from '@/data/solar-systems';
import { generateWorlds } from '@/data/worlds';

const choice = (probabilities: Record<string, number>) => {
  const [best] = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return {
    type: 'choice',
    choice: best[0],
    probabilities,
    confidence: best[1],
  };
};

/** A fake network: homepages answer with a title; Jev answers as scripted. */
function fakeFetch(
  answers: (body: { questions: Record<string, unknown> }) => unknown,
) {
  const calls: { url: string; auth?: string }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      auth: (init?.headers as Record<string, string> | undefined)
        ?.Authorization,
    });
    if (url === JEV_ENDPOINT) {
      const body = JSON.parse(init?.body as string);
      return new Response(JSON.stringify(answers(body)));
    }
    return new Response('<title>A tiny site</title>');
  };
  return { impl: impl as typeof fetch, calls };
}

const project = {
  id: 'new-world',
  name: 'New World',
  kind: 'Public project',
  url: 'https://new-world.alirezaafshan.com',
  description: 'Something new.',
};

describe('autonomous world classification', () => {
  it('applies confident picks, opens a curated family, and otherwise uses Frontier', () => {
    const kind = choice({ ocean: 0.7, garden: 0.3 });
    expect(
      decide(
        {
          family: choice({ 'patterns-and-life': 0.8, 'none-of-these': 0.2 }),
          kind,
        },
        { canOpenFamily: true },
      ),
    ).toEqual({
      place: 'family',
      familyId: 'patterns-and-life',
      terrain: 'ocean',
    });
    const none = choice({ 'patterns-and-life': 0.2, 'none-of-these': 0.8 });
    const theme = choice({ 'sound-and-stage': 0.9, 'worlds-and-games': 0.1 });
    expect(
      decide({ family: none, kind, theme }, { canOpenFamily: true }),
    ).toEqual({
      place: 'new-family',
      themeId: 'sound-and-stage',
      terrain: 'ocean',
    });
    // A full galaxy never opens another family.
    expect(
      decide({ family: none, kind, theme }, { canOpenFamily: false }).place,
    ).toBe('frontier');
    // Unsure answers stay on the Frontier.
    expect(
      decide(
        {
          family: choice({
            'patterns-and-life': 0.4,
            'curiosity-and-play': 0.35,
            'none-of-these': 0.25,
          }),
          kind,
        },
        { canOpenFamily: true },
      ).place,
    ).toBe('frontier');
  });

  it('never reuses a slot, including tombstones', () => {
    expect(
      nextSlot('ideas-and-inquiry', [
        { systemId: 'ideas-and-inquiry', orbitSlot: 0 },
        { systemId: 'ideas-and-inquiry', orbitSlot: 4 },
        { systemId: 'frontier', orbitSlot: 9 },
      ]),
    ).toBe(5);
    expect(nextSlot('sound-and-stage', [])).toBe(0);
  });

  it('validates Jev choices and renormalizes small rounding drift', () => {
    const answer = choice({ a: 0.505, b: 0.505 });
    validateChoice(answer, ['a', 'b']);
    expect(answer.probabilities.a + answer.probabilities.b).toBeCloseTo(1, 8);
    expect(() =>
      validateChoice(choice({ a: 0.6, b: 0.2 }), ['a', 'b']),
    ).toThrow(/sum to one/);
    expect(() => validateChoice(choice({ a: 1 }), ['a', 'b'])).toThrow(
      /coverage/,
    );
  });

  it('places a new world, opens a family before Frontier, and logs no key', async () => {
    const { impl, calls } = fakeFetch((body) => ({
      model: JEV_MODEL,
      answers: {
        family: choice(
          Object.fromEntries(
            Object.keys(
              (body.questions.family as { criteria: Record<string, string> })
                .criteria,
            ).map((id) => [id, id === 'none-of-these' ? 1 : 0]),
          ),
        ),
        kind: choice({
          ocean: 0,
          garden: 0,
          desert: 0,
          folds: 0,
          culture: 0,
          gas: 1,
        }),
        theme: choice(
          Object.fromEntries(
            familyData.themes.map((t) => [
              t.id,
              t.id === 'sound-and-stage' ? 1 : 0,
            ]),
          ),
        ),
      },
    }));
    const result = await classifyNewWorlds({
      newWorlds: [project],
      familyData,
      catalog: [],
      addresses: [],
      key: 'test-key',
      fetchImpl: impl,
      now: 0,
    });
    expect(result.placements.get('new-world')).toEqual({
      systemId: 'sound-and-stage',
      orbitSlot: 0,
    });
    const ids = result.families.active.map(
      (family: { id: string }) => family.id,
    );
    expect(ids.at(-1)).toBe('frontier');
    expect(ids.at(-2)).toBe('sound-and-stage');
    expect(
      result.families.themes.some(
        (t: { id: string }) => t.id === 'sound-and-stage',
      ),
    ).toBe(false);
    expect((result.terrain as Record<string, unknown>)['new-world']).toEqual({
      terrain: 'gas',
    });
    expect(JSON.stringify(result.log)).not.toContain('test-key');
    expect(calls.find((call) => call.url === JEV_ENDPOINT)?.auth).toBe(
      'Bearer test-key',
    );
    // The input family list is left untouched for the caller to save.
    expect(familyData.active.map((family) => family.id)).not.toContain(
      'sound-and-stage',
    );
  });

  it('falls back to Frontier when Jev fails, without printing its body', async () => {
    const impl = (async (url: string) =>
      url === JEV_ENDPOINT
        ? new Response('secret-bearing body', { status: 401 })
        : new Response('')) as typeof fetch;
    const result = await classifyNewWorlds({
      newWorlds: [project],
      familyData,
      catalog: [],
      addresses: [{ systemId: 'frontier', orbitSlot: 2 }],
      key: 'test-key',
      fetchImpl: impl,
    });
    expect(result.placements.get('new-world')).toEqual({
      systemId: 'frontier',
      orbitSlot: 3,
    });
    expect((result.log[0] as { error?: string }).error).toBe(
      'Jev request failed with HTTP 401',
    );
    expect(JSON.stringify(result.log)).not.toContain('secret-bearing');
  });

  it('caps active families at what the galaxy can place', () => {
    // The homeworld plus one star per active family must all fit.
    const seeds = Array.from({ length: 1 + MAX_ACTIVE_FAMILIES }, (_, i) => ({
      id: `family-${i}`,
      name: `Family ${i}`,
      kind: 'Project solar system',
      url: `https://family-${i}.alirezaafshan.com`,
      description: 'A family star.',
      relationship: 'owned' as const,
      hosting: 'first-party' as const,
      status: 'live' as const,
      glyph: '*',
      size: 1.05,
    }));
    expect(generateWorlds(seeds)).toHaveLength(1 + MAX_ACTIVE_FAMILIES);
  });

  it('finds a moved world from an old address', () => {
    const moved = parseSystemRoute('#system/patterns-and-life/cube');
    expect(moved?.system.id).toBe('curiosity-and-play');
    expect(moved?.system.planets[moved.planetIndex!].id).toBe('cube');
    expect(parseSystemRoute('#system/vanished-system/plato')?.system.id).toBe(
      'patterns-and-life',
    );
    expect(parseSystemRoute('#system/patterns-and-life/missing')).toBeNull();
  });
});
