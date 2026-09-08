import { describe, expect, it } from 'vitest';
import { webring } from '@/data/webring';
import registry from '@/data/world-registry.json';
import {
  destinations,
  MIN_WORLD_SPACING,
  worldCatalog,
  worldDistance,
} from '@/data/worlds';

const requiredWorlds = [
  'portfolio',
  'celegans-lab',
  'proof-bonsai',
  'aquarium',
  'bird-of-the-day',
  'android-hell',
  'conspiracy',
  'codex-continuity',
  'sponsor-my-microduck',
  'agar-protocol',
  'deploy-manager',
];

describe('world catalog', () => {
  it('keeps every confirmed world mapped exactly once', () => {
    expect(registry.projects.map(({ id }) => id)).toEqual(expect.arrayContaining(requiredWorlds));
    expect(new Set(destinations.map(({ id }) => id)).size).toBe(destinations.length);
    expect(destinations.length).toBeLessThanOrEqual(18);
    expect(new Set(destinations.map(({ url }) => url)).size).toBe(
      destinations.length,
    );
  });

  it('keeps the portfolio as the default homeworld', () => {
    expect(destinations[0]).toMatchObject({
      id: 'portfolio',
      relationship: 'owned',
      hosting: 'first-party',
      iconSrc: 'https://portfolio.alirezaafshan.com/apple-touch-icon.png',
    });
  });
  it('maps ChatJimmy as a discovery in the separate web ring', () => {
    expect(webring.find(({ id }) => id === 'chatjimmy')).toMatchObject({
      url: 'https://chatjimmy.ai/',
      kind: 'inspiration',
    });
    expect(destinations.some(({ id }) => id === 'chatjimmy')).toBe(false);
  });

  it('reserves the home galaxy for owned projects and puts collaborations in the web ring', () => {
    expect(
      destinations.every(({ relationship }) => relationship === 'owned'),
    ).toBe(true);
    expect(webring.find(({ id }) => id === 'learn2design')).toMatchObject({
      kind: 'collaboration',
    });
    const worldUrls = new Set(destinations.map(({ url }) => url));
    expect(webring.every(({ url }) => !worldUrls.has(url))).toBe(true);
    expect(
      destinations.find(({ id }) => id === 'codex-continuity'),
    ).toMatchObject({
      relationship: 'owned',
      hosting: 'first-party',
    });
  });

  it('uses verified public domains instead of development hosts', () => {
    for (const world of destinations) {
      expect(new URL(world.url).hostname.endsWith('.alirezaafshan.com')).toBe(true);
      expect(world.hosting).toBe('first-party');
    }
    expect(destinations.find(({ id }) => id === 'conspiracy')?.url).toBe(
      'https://conspiracy.alirezaafshan.com',
    );
    expect(destinations.find(({ id }) => id === 'codex-continuity')?.url).toBe(
      'https://continuity.alirezaafshan.com',
    );
    expect(destinations.some(({ id }) => id === 'application-builder')).toBe(false);
  });

  it('keeps the retired Oyster runtime out of the public catalog', () => {
    expect(registry.deniedIds).toContain('oyster-house');
    expect(destinations.some(({ id }) => id === 'oyster-house')).toBe(false);
  });

  it('uses the current published brand icons', () => {
    expect(destinations.find(({ id }) => id === 'agar-protocol')?.iconSrc).toBe(
      'https://agar.alirezaafshan.com/agar-mark-02.svg',
    );
    expect(destinations.find(({ id }) => id === 'deploy-manager')?.iconSrc).toBe(
      'https://deploy.alirezaafshan.com/favicon.svg',
    );
    expect(webring.find(({ id }) => id === 'chatjimmy')?.iconSrc).toBe(
      'https://chatjimmy.ai/favicon.ico',
    );
  });

  it('materializes safe deterministic galaxy coordinates', () => {
    expect(destinations).toHaveLength(worldCatalog.length);
    for (const destination of destinations) {
      expect(Number.isFinite(destination.radius)).toBe(true);
      expect(Number.isFinite(destination.angle)).toBe(true);
      expect(Number.isFinite(destination.size)).toBe(true);
      expect(destination.radius).toBeGreaterThan(0);
      expect(destination.size).toBeGreaterThan(0);
    }
  });

  it('keeps every world far enough apart to remain a distinct target', () => {
    for (let first = 0; first < destinations.length; first += 1) {
      for (let second = first + 1; second < destinations.length; second += 1) {
        expect(
          worldDistance(destinations[first], destinations[second]),
        ).toBeGreaterThanOrEqual(MIN_WORLD_SPACING);
      }
    }
  });
});
