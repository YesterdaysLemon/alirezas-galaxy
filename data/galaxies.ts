import {
  generateWorlds,
  worldCatalog,
  type CatalogWorld,
  type Destination,
  type WorldSeed,
} from './worlds';
import {
  buildSolarSystems,
  solarSystems,
  systemFamilies,
  systemHref,
  type SolarSystem,
} from './solar-systems';
import { webring } from './webring';

/** One direct homeworld and at most one star per family, however large its catalog. */
export function buildGalaxyDestinations(
  catalog: readonly CatalogWorld[],
  systems: readonly SolarSystem[] = buildSolarSystems(catalog),
): Destination[] {
  const home = catalog.find(
    (world) => world.id === 'portfolio' && world.status !== 'archived',
  );
  const markers: WorldSeed[] = home
    ? [{ ...home, systemId: undefined, orbitSlot: undefined }]
    : [];
  for (const family of systemFamilies) {
    const members = systems.filter(
      (system) =>
        system.id === family.id || system.id.startsWith(`${family.id}-`),
    );
    if (!members.length) continue;
    const first = members[0];
    const projectCount = members.reduce(
      (count, system) =>
        count + system.planets.filter((planet) => planet.projectId).length,
      0,
    );
    markers.push({
      id: family.id,
      name: family.name,
      kind: `${projectCount} ${projectCount === 1 ? 'world' : 'worlds'} around ${family.starName}`,
      systemId: first.id,
      url: `https://alirezaafshan.com/${systemHref(first.id)}`,
      description: `${family.subtitle} ${projectCount} public worlds across ${members.length} ${members.length === 1 ? 'system' : 'systems'}.`,
      relationship: 'owned',
      hosting: 'first-party',
      status: 'live',
      glyph: '*',
      color: Number.parseInt(family.color.slice(1), 16),
      size: 1.05,
    });
  }
  return generateWorlds(markers);
}

export const galaxyDestinations: Destination[] = buildGalaxyDestinations(
  worldCatalog,
  solarSystems,
);

export const galaxies = {
  home: { id: 'home', label: 'my galaxy', arms: 5, worlds: galaxyDestinations },
  webring: {
    id: 'webring',
    label: 'web ring',
    arms: 3,
    worlds: generateWorlds(
      webring.map((neighbor) => ({
        ...neighbor,
        relationship: 'collaboration' as const,
        hosting: 'external' as const,
        status: 'live' as const,
        color: 0x9aeaff,
      })),
      3,
    ),
  },
} as const;

export type GalaxyId = keyof typeof galaxies;
