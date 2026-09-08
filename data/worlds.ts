import generatedWorlds from './worlds.generated.json' with { type: 'json' };

export type Destination = {
  id: string;
  name: string;
  kind: string;
  url: string;
  description: string;
  relationship: 'owned' | 'collaboration';
  hosting: 'first-party' | 'external';
  status: 'live' | 'sleeping' | 'preview' | 'archived';
  iconSrc?: string;
  glyph: string;
  color: number;
  radius: number;
  angle: number;
  size: number;
};

type WorldSeed = Omit<Destination, 'color' | 'radius' | 'angle' | 'size'> &
  Partial<Pick<Destination, 'color' | 'radius' | 'angle' | 'size'>>;

const TAU = Math.PI * 2;
const GALAXY_ARMS = 5;
export const MIN_WORLD_SPACING = 4.8;
const PLACEMENT_ANGLES_PER_BAND = 41;
const PLACEMENT_RADIAL_BANDS = 29;
const PLACEMENT_ANGLE_STEP = 0.15;
const PLACEMENT_RADIUS_STEP = 0.4;
const generatedColors = [
  0x70dfff, 0x9affeb, 0xffe67d, 0x72a8ff, 0xffa6e4, 0xbda2ff, 0xffba6b,
];

function hashUnit(value: string, salt = 0) {
  let hash = 2166136261 ^ salt;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

export function worldDistance(
  first: Pick<Destination, 'radius' | 'angle'>,
  second: Pick<Destination, 'radius' | 'angle'>,
) {
  const firstX = Math.cos(first.angle) * first.radius;
  const firstZ = Math.sin(first.angle) * first.radius;
  const secondX = Math.cos(second.angle) * second.radius;
  const secondZ = Math.sin(second.angle) * second.radius;
  return Math.hypot(firstX - secondX, firstZ - secondZ);
}

function materializeWorld(
  world: WorldSeed,
  index: number,
  placedWorlds: Destination[],
  arms = GALAXY_ARMS,
): Destination {
  const identity = `${world.name}:${world.url}`;
  const seedRadius = world.radius ?? 5.2 + hashUnit(identity, 11) * 5.8;
  const arm = index % arms;
  const armAngle = (arm / arms) * TAU;
  const armJitter = (hashUnit(identity, 29) - 0.5) * 0.34;
  const seedAngle = world.angle ?? armAngle + seedRadius * 0.49 + armJitter;
  const preferredAngularDirection = hashUnit(identity, 97) < 0.5 ? -1 : 1;
  const preferredRadialDirection = hashUnit(identity, 113) < 0.5 ? -1 : 1;
  let radius = seedRadius;
  let angle = seedAngle;
  let positionFound = false;

  placement: for (
    let radialBand = 0;
    radialBand < PLACEMENT_RADIAL_BANDS;
    radialBand += 1
  ) {
    const radialDistance = Math.ceil(radialBand / 2);
    const radialDirection =
      radialBand === 0
        ? 0
        : (radialBand % 2 === 1 ? 1 : -1) * preferredRadialDirection;
    const candidateRadius = clamp(
      seedRadius + radialDirection * radialDistance * PLACEMENT_RADIUS_STEP,
      4.8,
      12.4,
    );

    for (
      let angularStep = 0;
      angularStep < PLACEMENT_ANGLES_PER_BAND;
      angularStep += 1
    ) {
      const angularDistance = Math.ceil(angularStep / 2);
      const angularDirection =
        angularStep === 0
          ? 0
          : (angularStep % 2 === 1 ? 1 : -1) * preferredAngularDirection;
      const candidate = {
        radius: candidateRadius,
        angle:
          seedAngle + angularDirection * angularDistance * PLACEMENT_ANGLE_STEP,
      };

      if (
        placedWorlds.every(
          (placedWorld) =>
            worldDistance(candidate, placedWorld) >= MIN_WORLD_SPACING,
        )
      ) {
        radius = candidate.radius;
        angle = candidate.angle;
        positionFound = true;
        break placement;
      }
    }
  }

  if (!positionFound) {
    throw new Error(
      `No interaction-safe galaxy position remains for world "${world.id}".`,
    );
  }

  return {
    ...world,
    color:
      world.color ??
      generatedColors[
        Math.floor(hashUnit(identity, 47) * generatedColors.length)
      ],
    radius,
    angle,
    size: world.size ?? 0.7 + hashUnit(identity, 71) * 0.24,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

// Add one object here to map a new website. Orbit, arm, color, and marker size
// are generated deterministically when omitted. Supplied coordinates are seed
// preferences and still pass through the same interaction-spacing rule as every
// other world. The first entry is the default homeworld.
export const worldCatalog: WorldSeed[] = generatedWorlds as WorldSeed[];

export function generateWorlds(catalog: WorldSeed[], arms = GALAXY_ARMS) {
  return catalog.reduce<Destination[]>((placedWorlds, world, index) => {
    placedWorlds.push(materializeWorld(world, index, placedWorlds, arms));
    return placedWorlds;
  }, []);
}

export const destinations = generateWorlds(worldCatalog);
