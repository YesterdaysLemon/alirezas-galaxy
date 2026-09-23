import { worldCatalog, type CatalogWorld, type Destination } from './worlds';

/** Optional artistic controls for a world's generated surface (see the planet lab). */
export type SurfaceTuning = {
  /** 0..1 fraction of the surface that is sea, ice leads, or basin. */
  sea?: number;
  /** Continental scale: lower is fewer, larger landmasses. */
  continents?: number;
  /** Polar cap reach, 0 (none) .. 1 (snowball). */
  ice?: number;
  /** Cloud cover 0..1. */
  clouds?: number;
  /** Relief exaggeration for geometry and bump. */
  relief?: number;
  /** Secondary feature density: dunes, ridges, colonies, storm bands. */
  detail?: number;
};

/** Art is fictional; all project-facing metadata comes from the public catalog. */
export type PlanetRecipe = {
  id: string;
  projectId?: string;
  name: string;
  shortName?: string;
  kind: string;
  description: string;
  url?: string;
  iconSrc?: string;
  status?: Destination['status'];
  seed: number;
  terrain: 'folds' | 'desert' | 'garden' | 'ocean' | 'culture' | 'gas';
  colors: [string, string, string, string];
  atmosphere: string;
  radius: number;
  orbit: number;
  phase: number;
  moons?: number;
  rings?: boolean;
  surface?: SurfaceTuning;
};

export type SolarSystem = {
  id: string;
  name: string;
  subtitle: string;
  starName: string;
  seed: number;
  star: { color: string; classification: string; radius: number };
  nebula: [string, string];
  planets: PlanetRecipe[];
  belts: SystemBelt[];
  /** Outer reach of the belts: the whole system. */
  extent: number;
  /** Outer reach of the worlds alone: what an overview frames. */
  frame: number;
};

/**
 * Scenery earned by growth. A Kuiper belt of sparse ice rings every system; an
 * inner asteroid belt marks the frost line inside the first gas giant, or, in
 * some systems without one, a seeded gap among the rocky worlds.
 */
export type SystemBelt = {
  kind: 'asteroid' | 'kuiper';
  inner: number;
  outer: number;
  count: number;
  seed: number;
};

// orbitSlot is a permanent family-wide address, not the index of a live list.
// A system grows one lane at a time, outward, until a sister system opens.
export const PROJECT_SLOTS_PER_SYSTEM = 8;
const STAR_RADIUS = 3.8;

/**
 * Lanes widen outward, like a real system's spacing, so an outer lane can hold
 * a ringed giant while inner lanes suit rocky worlds. A lane's orbit depends
 * only on its index: growth and removals never move another world.
 */
export function laneOrbit(lane: number) {
  return 7.5 + lane * 6.2 + lane * lane * 0.55;
}

/** The widest envelope a world in this lane may have without touching a neighbour's. */
function laneEnvelope(lane: number) {
  const inward =
    lane === 0
      ? (laneOrbit(0) - STAR_RADIUS * 1.4) * 2
      : laneOrbit(lane) - laneOrbit(lane - 1);
  const outward = laneOrbit(lane + 1) - laneOrbit(lane);
  return Math.min(inward, outward) / 2 - 0.35;
}

/** Radius multiple a world's moons or rings reach. */
export function envelopeScale(planet: Pick<PlanetRecipe, 'moons' | 'rings'>) {
  return planet.moons ? 3.35 : planet.rings ? 2.5 : 1.1;
}
export const systemFamilies = [
  {
    id: 'patterns-and-life',
    name: 'Patterns & Life',
    subtitle: 'Small worlds. Emergent things.',
    starName: 'Lumen',
    color: '#ffe2a0',
    classification: 'Warm gold star',
    nebula: ['#244e6a', '#654465'],
  },
  {
    id: 'curiosity-and-play',
    name: 'Curiosity & Play',
    subtitle: 'Field notes, little machines, imagined realms.',
    starName: 'Lucida',
    color: '#b7eaff',
    classification: 'Blue-white star',
    nebula: ['#263e79', '#76528b'],
  },
  {
    id: 'tools-and-infrastructure',
    name: 'Tools & Infrastructure',
    subtitle: 'Quiet machinery that keeps the work moving.',
    starName: 'Vigil',
    color: '#ffc68c',
    classification: 'Amber star',
    nebula: ['#243f5b', '#665042'],
  },
  {
    id: 'ideas-and-inquiry',
    name: 'Ideas & Inquiry',
    subtitle: 'Essays, research and questions put to the test.',
    starName: 'Vesper',
    color: '#ffd2c2',
    classification: 'Rose-white star',
    nebula: ['#3a2c5c', '#6b4454'],
  },
  {
    id: 'frontier',
    name: 'Frontier',
    subtitle: 'New public worlds, with room to grow.',
    starName: 'Aster',
    color: '#d6c5ff',
    classification: 'Pale violet star',
    nebula: ['#293660', '#58476e'],
  },
] as const;

type TerrainRecipe = Pick<
  PlanetRecipe,
  | 'seed'
  | 'terrain'
  | 'colors'
  | 'atmosphere'
  | 'radius'
  | 'phase'
  | 'moons'
  | 'rings'
  | 'surface'
>;

// Immutable project IDs are the only lookup key. A rename or domain move cannot
// change a world's terrain. The first five retain their original authored art.
const authoredTerrain: Record<string, TerrainRecipe> = {
  'celegans-lab': {
    seed: 302,
    terrain: 'desert',
    colors: ['#713826', '#b9733d', '#e5ae65', '#ffe6ad'],
    atmosphere: '#ffc773',
    radius: 0.7,
    phase: 2.85,
  },
  plato: {
    seed: 4313,
    terrain: 'folds',
    colors: ['#17375c', '#4d7294', '#99b7bd', '#e4e0c8'],
    atmosphere: '#87d7ff',
    radius: 1.08,
    phase: 0.4,
    moons: 1,
  },
  'proof-bonsai': {
    seed: 811,
    terrain: 'garden',
    colors: ['#1d596b', '#427d45', '#90b465', '#e9deb1'],
    atmosphere: '#bde5a3',
    radius: 0.98,
    phase: 4.1,
  },
  aquarium: {
    seed: 7109,
    terrain: 'ocean',
    colors: ['#072b68', '#087eab', '#62c3c1', '#f3dfb3'],
    atmosphere: '#7fcfff',
    radius: 1.22,
    phase: 2.28,
    moons: 2,
  },
  'agar-protocol': {
    seed: 9173,
    terrain: 'culture',
    colors: ['#302246', '#694e80', '#c791b7', '#f3ddb1'],
    atmosphere: '#e4aeff',
    radius: 0.94,
    phase: 5.1,
  },
  dmelanogaster: {
    seed: 7331,
    terrain: 'desert',
    colors: ['#5a2e1c', '#a7652d', '#d9a15a', '#f6dfb0'],
    atmosphere: '#ffd08a',
    radius: 0.8,
    phase: 4.6,
  },
  openwater: {
    seed: 5150,
    terrain: 'ocean',
    colors: ['#06305e', '#0a74a6', '#58c6d4', '#f1e2b8'],
    atmosphere: '#8fdcff',
    radius: 1.1,
    phase: 1.2,
    moons: 1,
    surface: { sea: 0.86, clouds: 0.62 },
  },
  morphogenesis: {
    seed: 2718,
    terrain: 'culture',
    colors: ['#3b1d3c', '#8a3f78', '#e58bc0', '#fde3c8'],
    atmosphere: '#ffb3e6',
    radius: 1,
    phase: 0.9,
  },
  astrapop: {
    seed: 4404,
    terrain: 'gas',
    colors: ['#4a2a6e', '#c46bd8', '#ff9fd8', '#ffe3f6'],
    atmosphere: '#ff9ff0',
    radius: 1.2,
    phase: 3.4,
  },
  'bird-of-the-day': {
    seed: 2407,
    terrain: 'garden',
    colors: ['#203b50', '#52704d', '#bbac73', '#f0e4b9'],
    atmosphere: '#d9e9aa',
    radius: 1.12,
    phase: 1.7,
    moons: 1,
  },
  'sponsor-my-microduck': {
    seed: 4004,
    terrain: 'ocean',
    colors: ['#17445b', '#278a99', '#d8b657', '#ffebb1'],
    atmosphere: '#a8e7e0',
    radius: 0.78,
    phase: 4.6,
  },
  'android-hell': {
    seed: 6091,
    terrain: 'culture',
    colors: ['#3b2438', '#874451', '#d88765', '#f5c794'],
    atmosphere: '#f5a793',
    radius: 1.04,
    phase: 0.8,
  },
  conspiracy: {
    seed: 1937,
    terrain: 'folds',
    colors: ['#272d44', '#55676e', '#a0ad99', '#e6d4b1'],
    atmosphere: '#b1cece',
    radius: 0.96,
    phase: 3.9,
    moons: 1,
  },
  animator: {
    seed: 2412,
    terrain: 'desert',
    colors: ['#4b3655', '#a66f86', '#e5b28c', '#ffedbe'],
    atmosphere: '#f3c6e5',
    radius: 0.85,
    phase: 5.4,
  },
  herald: {
    seed: 1284,
    terrain: 'garden',
    colors: ['#263965', '#57735c', '#b7a760', '#f1e1ad'],
    atmosphere: '#b3cfff',
    radius: 1.18,
    phase: 2.3,
    moons: 1,
  },
  'codex-continuity': {
    seed: 8088,
    terrain: 'folds',
    colors: ['#273953', '#577795', '#a6c1bf', '#e7e5ca'],
    atmosphere: '#aad6f3',
    radius: 1.16,
    phase: 3.2,
    moons: 1,
  },
  'deploy-manager': {
    seed: 4096,
    terrain: 'desert',
    colors: ['#443343', '#956450', '#d79d69', '#f7ddab'],
    atmosphere: '#ffd0a0',
    radius: 1.2,
    phase: 0.5,
  },
  valet: {
    seed: 7331,
    terrain: 'ocean',
    colors: ['#1b354e', '#3c7484', '#9cbea7', '#e5deb8'],
    atmosphere: '#b9e5df',
    radius: 0.82,
    phase: 4.8,
  },
};

function identitySeed(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

const palettes: Pick<TerrainRecipe, 'terrain' | 'colors' | 'atmosphere'>[] = [
  {
    terrain: 'desert',
    colors: ['#573247', '#ad7560', '#d8b07b', '#f7e6bf'],
    atmosphere: '#ffce9b',
  },
  {
    terrain: 'garden',
    colors: ['#243e57', '#4a8071', '#a9be79', '#e5e2bc'],
    atmosphere: '#b4e1c3',
  },
  {
    terrain: 'folds',
    colors: ['#33385d', '#76789f', '#b6b2ca', '#f2dfc7'],
    atmosphere: '#c0ceff',
  },
  {
    terrain: 'ocean',
    colors: ['#172e5c', '#28768f', '#80bfb4', '#eddaad'],
    atmosphere: '#8ddafa',
  },
  {
    terrain: 'culture',
    colors: ['#382953', '#805c84', '#b996ab', '#ecddad'],
    atmosphere: '#e4bcf1',
  },
];
function terrainFor(id: string): TerrainRecipe {
  if (Object.hasOwn(authoredTerrain, id)) return authoredTerrain[id];
  const seed = identitySeed(id);
  return {
    ...palettes[seed % palettes.length],
    seed,
    radius: 0.8 + ((seed >>> 8) % 40) / 100,
    phase: ((seed >>> 16) / 65536) * Math.PI * 2,
    moons: seed % 3 === 0 ? 1 : 0,
  };
}

export function buildSolarSystems(
  catalog: readonly CatalogWorld[],
): SolarSystem[] {
  const groups = new Map<string, Map<number, CatalogWorld[]>>();
  const addresses = new Set<string>();
  const ids = new Set<string>();
  for (const world of catalog) {
    if (world.status === 'archived') continue;
    if (ids.has(world.id))
      throw new Error(`Duplicate public project ${world.id}`);
    ids.add(world.id);
    if (
      world.id === 'portfolio' &&
      world.systemId === 'home' &&
      world.orbitSlot === 0
    )
      continue;
    if (
      !systemFamilies.some((family) => family.id === world.systemId) ||
      !Number.isSafeInteger(world.orbitSlot) ||
      world.orbitSlot < 0
    ) {
      throw new Error(
        `Missing or invalid stable system address for ${world.id}`,
      );
    }
    const address = `${world.systemId}/${world.orbitSlot}`;
    if (addresses.has(address))
      throw new Error(`Duplicate system address ${address}`);
    addresses.add(address);
    const chunk = Math.floor(world.orbitSlot / PROJECT_SLOTS_PER_SYSTEM);
    const family =
      groups.get(world.systemId) ?? new Map<number, CatalogWorld[]>();
    const members = family.get(chunk) ?? [];
    members.push(world);
    family.set(chunk, members);
    groups.set(world.systemId, family);
  }

  const systems: SolarSystem[] = [];
  for (const family of systemFamilies) {
    for (const [chunk, members] of [...(groups.get(family.id) ?? [])].sort(
      ([a], [b]) => a - b,
    )) {
      const id = chunk === 0 ? family.id : `${family.id}-${chunk + 1}`;
      const seed = identitySeed(id);
      const planets: PlanetRecipe[] = members
        .sort((a, b) => a.orbitSlot - b.orbitSlot)
        .map((world) => {
          const lane = world.orbitSlot % PROJECT_SLOTS_PER_SYSTEM;
          const terrain = terrainFor(world.id);
          const giant = terrain.terrain === 'gas';
          // Gas giants are big, and ringed when their seed says so; every world
          // is fitted to its lane so moons and rings stay clear of neighbours.
          const wanted = {
            ...terrain,
            radius: giant ? Math.max(2.2, terrain.radius * 2) : terrain.radius,
            rings: terrain.rings ?? (giant && terrain.seed % 2 === 0),
            moons: terrain.moons ?? (giant ? 2 : undefined),
          };
          const room = laneEnvelope(lane) / envelopeScale(wanted);
          return {
            ...wanted,
            radius: Math.round(Math.min(wanted.radius, room) * 100) / 100,
            id: world.id,
            projectId: world.id,
            name: world.name,
            kind: world.kind,
            description: world.description,
            url: world.url,
            iconSrc: world.iconSrc,
            status: world.status,
            orbit: laneOrbit(lane),
          };
        });
      const reach = (planet: PlanetRecipe) =>
        planet.radius * envelopeScale(planet) + 0.3;
      const frame = Math.max(
        ...planets.map((planet) => planet.orbit + reach(planet)),
      );
      const belts: SystemBelt[] = [];
      // Frost line: just inside the first gas giant, if the gap allows.
      const bands = planets.map((planet, index) => ({
        inner:
          index === 0
            ? STAR_RADIUS * 1.8
            : planets[index - 1].orbit + reach(planets[index - 1]),
        outer: planet.orbit - reach(planet),
        giant: planet.terrain === 'gas',
      }));
      const frost = bands.find(
        (band) => band.giant && band.outer - band.inner > 2.2,
      );
      const inner =
        frost ??
        // Some systems without giants still carry a seeded inner belt.
        (planets.length >= 3 && seed % 3 !== 0
          ? bands
              .slice(1, Math.ceil(planets.length / 2) + 1)
              .filter((band) => band.outer - band.inner > 2.2)
              .sort((a, b) => b.outer - b.inner - (a.outer - a.inner))[0]
          : undefined);
      if (inner) {
        const width = Math.min(3, (inner.outer - inner.inner) * 0.45);
        const middle = (inner.inner + inner.outer) / 2;
        belts.push({
          kind: 'asteroid',
          inner: middle - width / 2,
          outer: middle + width / 2,
          count: Math.round(260 + middle * 4),
          seed: seed ^ 0x183,
        });
      }
      // The Kuiper belt rings the whole system, sparse and icy.
      const kuiperInner = frame + 5;
      const kuiperOuter = kuiperInner + 6 + frame * 0.12;
      belts.push({
        kind: 'kuiper',
        inner: kuiperInner,
        outer: kuiperOuter,
        count: Math.round(160 + kuiperOuter * 3),
        seed: seed ^ 0x51b7,
      });
      systems.push({
        id,
        name: chunk === 0 ? family.name : `${family.name} · ${chunk + 1}`,
        subtitle: family.subtitle,
        starName:
          chunk === 0 ? family.starName : `${family.starName} ${chunk + 1}`,
        seed,
        star: {
          color: family.color,
          classification: family.classification,
          radius: STAR_RADIUS,
        },
        nebula: [...family.nebula],
        planets,
        belts,
        extent: kuiperOuter + 3,
        frame,
      });
    }
  }
  return systems;
}

export const solarSystems: SolarSystem[] = buildSolarSystems(worldCatalog);

export function getSolarSystem(id: string): SolarSystem | undefined {
  return solarSystems.find((system) => system.id === id);
}

export function systemHref(systemId: string, planetId?: string): string {
  return `#system/${encodeURIComponent(systemId)}${planetId === undefined ? '' : `/${encodeURIComponent(planetId)}`}`;
}

export function parseSystemRoute(
  hash: string,
): { system: SolarSystem; planetIndex: number | null } | null {
  const parts = /^#system\/([^/]+)(?:\/([^/]+))?$/.exec(hash);
  if (!parts) return null;
  try {
    const system = getSolarSystem(decodeURIComponent(parts[1]));
    if (!system) return null;
    if (parts[2] === undefined) return { system, planetIndex: null };
    const planetIndex = system.planets.findIndex(
      (planet) => planet.id === decodeURIComponent(parts[2]),
    );
    return planetIndex < 0 ? null : { system, planetIndex };
  } catch {
    return null;
  }
}

export function planetPosition(
  planet: Pick<PlanetRecipe, 'orbit' | 'phase'>,
  time = 0,
) {
  const angle = planet.phase + (time * 0.028) / Math.sqrt(planet.orbit);
  return {
    x: Math.cos(angle) * planet.orbit,
    y: 0,
    z: Math.sin(angle) * planet.orbit,
  };
}
