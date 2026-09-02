import { describe, expect, it } from 'vitest';
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
  'application-builder',
  'learn2design',
  'android-hell',
  'conspiracy',
  'codex-continuity',
  'sponsor-my-microduck',
];

describe('world catalog', () => {
  it('keeps every confirmed world mapped exactly once', () => {
    expect(destinations.map(({ id }) => id)).toEqual(requiredWorlds);
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

  it('classifies collaboration separately from external hosting', () => {
    expect(destinations.find(({ id }) => id === 'learn2design')).toMatchObject({
      relationship: 'collaboration',
      hosting: 'external',
    });
    expect(
      destinations.find(({ id }) => id === 'codex-continuity'),
    ).toMatchObject({
      relationship: 'owned',
      hosting: 'external',
    });
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
