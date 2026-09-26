import { describe, expect, it } from 'vitest';
import {
  classifyNewWorlds,
  decide,
  FAMILY_LANES,
  familyIsFull,
  JEV_ENDPOINT,
  JEV_MODEL,
  LABELS,
  labelWorlds,
  nextSlot,
  rehomeOverflow,
  validateChoice,
} from '../../scripts/classify-worlds.mjs';
import liveFamilies from '@/data/families.json';
import {
  MAX_ACTIVE_FAMILIES,
  parseSystemRoute,
  PROJECT_SLOTS_PER_SYSTEM,
} from '@/data/solar-systems';
import { generateWorlds } from '@/data/worlds';

/**
 * A fixed galaxy for these tests: the daily refresh changes the live
 * families.json (opening themes as families), so tests never read it.
 */
const allFamilies = [...liveFamilies.active, ...liveFamilies.themes];
const pick = (ids: string[]) =>
  ids.map((id) => {
    const family = allFamilies.find((entry) => entry.id === id);
    if (!family) throw new Error(`Unknown family ${id}`);
    return family;
  });
const familyData = {
  maxActive: 9,
  active: pick([
    'patterns-and-life',
    'curiosity-and-play',
    'ideas-and-inquiry',
    'frontier',
  ]),
  themes: pick(['sound-and-stage', 'worlds-and-games', 'images-and-motion']),
};

const choice = (probabilities: Record<string, number>) => {
  const [best] = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return {
    type: 'choice',
    choice: best[0],
    probabilities,
    confidence: best[1],
  };
};

/** A certain answer: `winner` takes all the weight among `options`. */
const certain = (options: string[], winner: string) =>
  choice(Object.fromEntries(options.map((id) => [id, id === winner ? 1 : 0])));

type FakeQuestions = Record<string, { criteria: Record<string, string> }>;

/** Jev answering every question in the request, with scripted winners. */
function scriptedJev(winners: (id: string) => Partial<Record<string, string>>) {
  return (body: { questions: Record<string, unknown>; state?: string }) => {
    const questions = body.questions as FakeQuestions;
    const id =
      /A new project has appeared: ([^.]+)\./.exec(body.state ?? '')?.[1] ?? '';
    const picks = winners(id);
    return {
      model: JEV_MODEL,
      answers: Object.fromEntries(
        Object.entries(questions).map(([name, question]) => {
          const options = Object.keys(question.criteria);
          return [name, certain(options, picks[name] ?? options[0])];
        }),
      ),
    };
  };
}

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
        label: certain(Object.keys(LABELS), 'music'),
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
      label: 'Music and sound',
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

  it('names a placed world without asking where it belongs', async () => {
    const asked: string[][] = [];
    const { impl } = fakeFetch((body) => {
      asked.push(Object.keys(body.questions));
      return scriptedJev(() => ({ label: 'journal' }))(body);
    });
    const { labels, log } = await labelWorlds({
      worlds: [project],
      key: 'test-key',
      fetchImpl: impl,
      now: 0,
    });
    expect(asked).toEqual([['label']]);
    expect(labels).toEqual({ 'new-world': 'Research journal' });
    expect(log[0]).toMatchObject({ labelOnly: true });
  });

  it('agrees with the scene on how many worlds a system shows', () => {
    expect(FAMILY_LANES).toBe(PROJECT_SLOTS_PER_SYSTEM);
  });

  it('opens a theme instead of overfilling a family, and never reuses a former address', () => {
    const kind = choice({ ocean: 1, garden: 0 });
    const family = choice({ 'curiosity-and-play': 0.7, 'none-of-these': 0.3 });
    const theme = choice({ 'worlds-and-games': 0.9, 'sound-and-stage': 0.1 });
    const full = () => true;
    expect(
      decide({ family, kind, theme }, { canOpenFamily: true, isFull: full }),
    ).toMatchObject({
      place: 'new-family',
      themeId: 'worlds-and-games',
      reason: 'family-full',
    });
    // No room for another family: Frontier, whose star is visible, not a sister system.
    expect(
      decide({ family, kind, theme }, { canOpenFamily: false, isFull: full }),
    ).toMatchObject({ place: 'frontier', reason: 'family-full' });
    const addresses = [
      { systemId: 'curiosity-and-play', orbitSlot: 7 },
      { formerAddresses: ['curiosity-and-play/12', 'frontier/3'] },
    ];
    expect(nextSlot('curiosity-and-play', addresses)).toBe(13);
    expect(nextSlot('frontier', addresses)).toBe(4);
    expect(familyIsFull('curiosity-and-play', addresses)).toBe(true);
    expect(familyIsFull('ideas-and-inquiry', addresses)).toBe(false);
  });

  it('shows a confident project kind and nothing when unsure', () => {
    const base = {
      family: choice({ 'ideas-and-inquiry': 1, 'none-of-these': 0 }),
      kind: choice({ ocean: 1, garden: 0 }),
    };
    expect(
      decide(
        { ...base, label: choice({ journal: 0.8, essay: 0.2 }) },
        { canOpenFamily: true },
      ).label,
    ).toBe('Research journal');
    expect(
      decide(
        {
          ...base,
          label: choice({
            journal: 0.25,
            essay: 0.25,
            tool: 0.25,
            music: 0.25,
          }),
        },
        { canOpenFamily: true },
      ).label,
    ).toBeUndefined();
  });

  it('moves overflowing worlds to a visible home and leaves the rest', async () => {
    const worlds = [
      {
        ...project,
        id: 'game',
        name: 'Game',
        systemId: 'curiosity-and-play',
        orbitSlot: 9,
      },
      {
        ...project,
        id: 'drifter',
        name: 'Drifter',
        systemId: 'curiosity-and-play',
        orbitSlot: 10,
      },
      {
        ...project,
        id: 'settled',
        name: 'Settled',
        systemId: 'curiosity-and-play',
        orbitSlot: 2,
      },
    ];
    const lanes = Array.from({ length: 8 }, (_, orbitSlot) => ({
      systemId: 'curiosity-and-play',
      orbitSlot,
    }));
    const { impl } = fakeFetch(
      scriptedJev((name) =>
        name === 'Game'
          ? { family: 'curiosity-and-play', theme: 'worlds-and-games' }
          : { family: 'worlds-and-games' },
      ),
    );
    const result = await rehomeOverflow({
      worlds,
      familyData: { ...familyData, maxActive: familyData.active.length + 1 },
      catalog: worlds,
      addresses: [...lanes, ...worlds],
      key: 'test-key',
      fetchImpl: impl,
      now: 0,
    });
    // The game opens its theme's family; the second world, asked next, joins it.
    expect(result.moves.get('game')).toEqual({
      from: 'curiosity-and-play/9',
      to: { systemId: 'worlds-and-games', orbitSlot: 0 },
    });
    expect(result.moves.get('drifter')?.to).toEqual({
      systemId: 'worlds-and-games',
      orbitSlot: 1,
    });
    expect(result.moves.has('settled')).toBe(false);
    // Moving never repaints a planet; only a missing project kind is filled.
    for (const entry of Object.values(result.terrain))
      expect(entry).not.toHaveProperty('terrain');
    expect(
      result.families.active.map((family: { id: string }) => family.id),
    ).toContain('worlds-and-games');
    expect(
      result.log.every((entry: { rehome?: boolean }) => entry.rehome),
    ).toBe(true);
  });

  it('sends an unsure hidden world to Frontier, and leaves Frontier worlds there', async () => {
    const worlds = [
      {
        ...project,
        id: 'stuck',
        name: 'Stuck',
        systemId: 'curiosity-and-play',
        orbitSlot: 9,
      },
      {
        ...project,
        id: 'waiting',
        name: 'Waiting',
        systemId: 'frontier',
        orbitSlot: 0,
      },
    ];
    const { impl } = fakeFetch(
      scriptedJev(() => ({ family: 'curiosity-and-play' })),
    );
    const result = await rehomeOverflow({
      worlds,
      familyData: { ...familyData, maxActive: familyData.active.length },
      catalog: worlds,
      addresses: worlds,
      key: 'test-key',
      fetchImpl: impl,
      now: 0,
    });
    // Frontier/0 is taken, so the hidden world takes the next Frontier lane.
    expect(result.moves.get('stuck')).toEqual({
      from: 'curiosity-and-play/9',
      to: { systemId: 'frontier', orbitSlot: 1 },
    });
    expect(result.moves.has('waiting')).toBe(false);
    expect(result.log[1].decision).toMatchObject({ stayed: 'frontier/0' });
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
