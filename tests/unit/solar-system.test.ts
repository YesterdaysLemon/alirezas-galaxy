import { describe, expect, it } from 'vitest';
import {
  buildSolarSystems,
  solarSystems,
  getSolarSystem,
  parseSystemRoute,
  planetPosition,
  systemHref,
  type PlanetRecipe,
} from '../../data/solar-systems';
import { worldCatalog } from '../../data/worlds';
import {
  seededRandom,
  surfaceHeight,
  terrainNoise,
} from '../../lib/planet-textures';

const envelope = (planet: PlanetRecipe) =>
  planet.radius * (planet.moons ? 3.35 : planet.rings ? 2.5 : 1.1);

describe('catalog-driven solar systems', () => {
  it('keeps planet routes tied to identity and scenic terrain without a website', () => {
    for (const system of solarSystems) {
      expect(parseSystemRoute(systemHref(system.id))).toEqual({
        system,
        planetIndex: null,
      });
      system.planets.forEach((planet, planetIndex) => {
        expect(parseSystemRoute(systemHref(system.id, planet.id))).toEqual({
          system,
          planetIndex,
        });
        if (planet.projectId)
          expect(planet.url).toBe(
            worldCatalog.find((world) => world.id === planet.projectId)?.url,
          );
      });
    }
    const nacre = getSolarSystem('patterns-and-life')!.planets.find(
      (planet) => planet.id === 'nacre',
    )!;
    expect(nacre.projectId).toBeUndefined();
    expect(nacre.url).toBeUndefined();
    for (const route of [
      '#system/missing',
      '#system/patterns-and-life/missing',
      '#system/patterns-and-life/%FF',
      '#system/patterns-and-life/plato/extra',
    ]) {
      expect(parseSystemRoute(route)).toBeNull();
    }
  });

  it('preserves terrain, orbital address and system identity across reorder and metadata changes', () => {
    const changed = worldCatalog
      .map((world) => ({
        ...world,
        name: `Renamed ${world.id}`,
        url: `https://moved-${world.id}.alirezaafshan.com`,
        description: `Current ${world.id}`,
      }))
      .reverse();
    const rebuilt = buildSolarSystems(changed);
    for (const original of solarSystems) {
      const next = rebuilt.find((system) => system.id === original.id)!;
      expect(next.seed).toBe(original.seed);
      for (const planet of original.planets) {
        const updated = next.planets.find(
          (candidate) => candidate.id === planet.id,
        )!;
        expect({
          ...updated,
          name: planet.name,
          url: planet.url,
          description: planet.description,
        }).toEqual(planet);
      }
    }
    const withoutPlato = buildSolarSystems(
      worldCatalog.filter((world) => world.id !== 'plato'),
    );
    for (const system of withoutPlato) {
      expect(system.planets).toEqual(
        getSolarSystem(system.id)!.planets.filter(
          (planet) => planet.id !== 'plato',
        ),
      );
    }
  });

  it('keeps every project reachable exactly once beyond eighteen and never compacts companion slots', () => {
    const frontier = Array.from({ length: 31 }, (_, index) => ({
      ...worldCatalog[1],
      id: `frontier-${index}`,
      url: `https://frontier-${index}.alirezaafshan.com`,
      systemId: 'frontier',
      orbitSlot: index,
    }));
    const expanded = [...worldCatalog, ...frontier];
    const systems = buildSolarSystems(expanded);
    const addresses = systems.flatMap((system) =>
      system.planets
        .filter((planet) => planet.projectId)
        .map((planet) => ({
          id: planet.id,
          system: system.id,
          orbit: planet.orbit,
          seed: planet.seed,
        })),
    );
    expect(addresses.map(({ id }) => id).sort()).toEqual(
      expanded
        .filter((world) => world.id !== 'portfolio')
        .map((world) => world.id)
        .sort(),
    );
    const missing = new Set([
      'frontier-0',
      'frontier-3',
      'frontier-6',
      'frontier-18',
    ]);
    const survivorSystems = buildSolarSystems(
      expanded.filter((world) => !missing.has(world.id)).reverse(),
    );
    for (const address of addresses.filter(({ id }) => !missing.has(id))) {
      expect(
        survivorSystems
          .find((system) => system.id === address.system)!
          .planets.find((planet) => planet.id === address.id),
      ).toMatchObject({ orbit: address.orbit, seed: address.seed });
    }
    expect(() =>
      buildSolarSystems([...expanded, { ...frontier[0], id: 'collision' }]),
    ).toThrow(/Duplicate system address/);
  });

  it('keeps orbital envelopes, belts and framing clear throughout motion', () => {
    for (const system of solarSystems) {
      for (let index = 1; index < system.planets.length; index++) {
        const inner = system.planets[index - 1],
          outer = system.planets[index];
        expect(outer.orbit - inner.orbit).toBeGreaterThan(
          envelope(inner) + envelope(outer),
        );
      }
      for (const planet of system.planets) {
        expect(system.extent).toBeGreaterThan(planet.orbit + envelope(planet));
        for (const belt of system.belts) {
          expect(
            belt.outer < planet.orbit - envelope(planet) ||
              belt.inner > planet.orbit + envelope(planet),
          ).toBe(true);
          expect(system.extent).toBeGreaterThan(belt.outer);
        }
        for (const time of [0, 100, 10000]) {
          const position = planetPosition(planet, time);
          expect(Math.hypot(position.x, position.z)).toBeCloseTo(
            planet.orbit,
            8,
          );
        }
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
    for (const planet of solarSystems.flatMap((system) => system.planets)) {
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
