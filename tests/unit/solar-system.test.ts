import { describe, expect, it } from 'vitest';
import { patternsSystem, planetPosition } from '../../data/solar-systems';
import {
  seededRandom,
  surfaceHeight,
  terrainNoise,
} from '../../lib/planet-textures';

describe('the Patterns and Life system', () => {
  it('keeps public project identities distinct from the scenic giant', () => {
    const planets = patternsSystem.planets;
    expect(new Set(planets.map((planet) => planet.id)).size).toBe(
      planets.length,
    );
    expect(planets.filter((planet) => planet.url)).toHaveLength(5);
    expect(planets.find((planet) => planet.id === 'plato')?.url).toBe(
      'https://plato.alirezaafshan.com',
    );
    expect(
      planets.find((planet) => planet.id === 'nacre')?.url,
    ).toBeUndefined();
    planets
      .filter((planet) => planet.url)
      .forEach((planet) =>
        expect(new URL(planet.url!).protocol).toBe('https:'),
      );
  });

  it('keeps adjacent planet and ring envelopes apart during orbital motion', () => {
    const planets = patternsSystem.planets;
    for (let i = 1; i < planets.length; i++) {
      const inner = planets[i - 1],
        outer = planets[i];
      expect(outer.orbit - inner.orbit).toBeGreaterThan(
        inner.radius * (inner.rings ? 2.5 : 1.1) +
          outer.radius * (outer.rings ? 2.5 : 1.1),
      );
    }
    for (const planet of planets) {
      for (const time of [0, 100, 10000]) {
        const position = planetPosition(planet, time);
        expect(Math.hypot(position.x, position.z)).toBeCloseTo(planet.orbit, 8);
      }
    }
  });

  it('makes terrain repeatable and continuous through the longitude seam', () => {
    const first = seededRandom(302),
      second = seededRandom(302);
    expect(Array.from({ length: 20 }, first)).toEqual(
      Array.from({ length: 20 }, second),
    );
    expect(terrainNoise(1.5, 2.5, 3.5, 9)).not.toBe(
      terrainNoise(1.5, 2.5, 3.5, 10),
    );
    for (const planet of patternsSystem.planets) {
      const a = surfaceHeight(1, 0, 0, planet);
      const b = surfaceHeight(
        Math.cos(Math.PI * 2),
        0,
        Math.sin(Math.PI * 2),
        planet,
      );
      expect(a).toBeCloseTo(b, 10);
      expect(Number.isFinite(a)).toBe(true);
    }
  });
});
