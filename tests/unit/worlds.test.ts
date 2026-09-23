import { describe, expect, it } from 'vitest';
import { webring } from '@/data/webring';
import registry from '@/data/world-registry.json';
import { galaxyDestinations, buildGalaxyDestinations } from '@/data/galaxies';
import {
  solarSystems,
  buildSolarSystems,
  getSolarSystem,
  systemFamilies,
} from '@/data/solar-systems';
import { serializeWorlds, renderLlmsText } from '@/data/site';
import { MIN_WORLD_SPACING, worldCatalog, worldDistance } from '@/data/worlds';
import { publicUrl } from '../../scripts/refresh-worlds.mjs';

describe('public catalog and bounded galaxy', () => {
  it('publishes all registry destinations without substituting family gateways', () => {
    const published = serializeWorlds();
    expect(published.map(({ id }) => id).sort()).toEqual(
      registry.projects.map(({ id }) => id).sort(),
    );
    expect(new Set(published.map(({ url }) => url)).size).toBe(
      published.length,
    );
    expect(published.find(({ id }) => id === 'plato')?.url).toBe(
      'https://plato.alirezaafshan.com',
    );
    for (const world of worldCatalog) {
      expect(publicUrl(world.url)).toBe(world.url);
      expect(registry.deniedIds).not.toContain(world.id);
      expect(renderLlmsText()).toContain(`](${world.url})`);
    }
    expect(
      webring.every(({ url }) => !published.some((world) => world.url === url)),
    ).toBe(true);
  });

  it('keeps portfolio direct and maps each family star to an extant system', () => {
    expect(galaxyDestinations[0].id).toBe('portfolio');
    expect(galaxyDestinations[0].systemId).toBeUndefined();
    for (const marker of galaxyDestinations.slice(1)) {
      expect(
        getSolarSystem(marker.systemId!)?.planets.some(
          (planet) => planet.projectId,
        ),
      ).toBe(true);
      expect(marker.url).toBe(
        `https://alirezaafshan.com/#system/${marker.systemId}`,
      );
    }
    const members = solarSystems.flatMap((system) =>
      system.planets.flatMap((planet) =>
        planet.projectId ? [planet.projectId] : [],
      ),
    );
    expect(members.sort()).toEqual(
      worldCatalog
        .filter((world) => world.id !== 'portfolio')
        .map((world) => world.id)
        .sort(),
    );
    expect(buildGalaxyDestinations([])).toEqual([]);
  });

  it('bounds galaxy targets even when every family needs companion systems', () => {
    // Fill Frontier slots 0-89 around any real members already there.
    const taken = new Set(
      worldCatalog
        .filter((world) => world.systemId === 'frontier')
        .map((world) => world.orbitSlot),
    );
    const expanded = [
      ...worldCatalog,
      ...Array.from({ length: 90 }, (_, slot) => slot)
        .filter((slot) => !taken.has(slot))
        .map((slot) => ({
          ...worldCatalog[1],
          id: `new-${slot}`,
          url: `https://new-${slot}.alirezaafshan.com`,
          systemId: 'frontier',
          orbitSlot: slot,
        })),
    ];
    const systems = buildSolarSystems(expanded);
    const markers = buildGalaxyDestinations(expanded, systems);
    // The homeworld plus one star per populated family, however many systems.
    expect(markers).toHaveLength(1 + systemFamilies.length);
    expect(
      systems.filter((system) => system.id.startsWith('frontier')),
    ).toHaveLength(15);
    for (let first = 0; first < markers.length; first++) {
      for (let second = first + 1; second < markers.length; second++) {
        expect(
          worldDistance(markers[first], markers[second]),
        ).toBeGreaterThanOrEqual(MIN_WORLD_SPACING);
      }
    }
    const sparse = expanded.filter(
      (world) => world.systemId === 'frontier' && world.orbitSlot >= 12,
    );
    expect(buildGalaxyDestinations(sparse)[0].systemId).toBe('frontier-3');
  });
});
