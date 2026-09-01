export type Destination = {
  id: string;
  name: string;
  kind: string;
  url: string;
  description: string;
  relationship: 'owned' | 'collaboration';
  hosting: 'first-party' | 'external';
  status: 'live' | 'preview' | 'archived';
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
export const MIN_WORLD_SPACING = 3.2;
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
): Destination {
  const identity = `${world.name}:${world.url}`;
  let radius = world.radius ?? 5.2 + hashUnit(identity, 11) * 5.8;
  const arm = index % GALAXY_ARMS;
  const armAngle = (arm / GALAXY_ARMS) * TAU;
  const armJitter = (hashUnit(identity, 29) - 0.5) * 0.34;
  const generatedAngle = armAngle + radius * 0.49 + armJitter;
  let angle = world.angle ?? generatedAngle;
  const isArtDirected = world.radius !== undefined && world.angle !== undefined;

  if (!isArtDirected) {
    const preferredDirection = hashUnit(identity, 97) < 0.5 ? -1 : 1;

    // Search symmetrically around the seeded arm position. Generated worlds
    // may cluster naturally, but never closely enough to create competing hit
    // targets. Explicitly art-directed positions remain untouched.
    for (let attempt = 0; attempt < 17; attempt += 1) {
      const distanceFromSeed = Math.ceil(attempt / 2);
      const searchDirection =
        attempt === 0 ? 0 : (attempt % 2 === 1 ? 1 : -1) * preferredDirection;
      angle = generatedAngle + searchDirection * distanceFromSeed * 0.22;
      radius =
        world.radius ??
        clamp(
          5.2 + hashUnit(identity, 11) * 5.8 + Math.floor(attempt / 10) * 0.42,
          4.8,
          12,
        );
      const candidate = { radius, angle };
      if (
        placedWorlds.every(
          (placedWorld) =>
            worldDistance(candidate, placedWorld) >= MIN_WORLD_SPACING,
        )
      ) {
        break;
      }
    }
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
// are generated deterministically when omitted; supply any of them to art-direct
// a particularly important world. The first entry is the default homeworld.
export const worldCatalog: WorldSeed[] = [
  {
    id: 'portfolio',
    name: 'Alireza Afshan',
    kind: 'Portfolio · homeworld',
    url: 'https://portfolio.alirezaafshan.com',
    description: 'The person and the work at the center of this little galaxy.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    iconSrc: 'https://alirezaafshan.com/apple-touch-icon.png',
    glyph: 'A♦',
    color: 0x70dfff,
    radius: 8.6,
    angle: 1.73,
    size: 1.22,
  },
  {
    id: 'celegans-lab',
    name: 'C. elegans Lab',
    kind: 'Live simulation',
    url: 'https://worm.alirezaafshan.com',
    description:
      'A 302-neuron connectome and body running as one browser loop.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    iconSrc:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M3 16C7 7 12 25 16 16s6-9 13 0' fill='none' stroke='%23e2a04a' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E",
    glyph: '〰',
    color: 0x9affeb,
    radius: 5.05,
    angle: 2.82,
    size: 0.86,
  },
  {
    id: 'proof-bonsai',
    name: 'Proof Bonsai',
    kind: 'Live research map',
    url: 'https://proof-bonsai.alirezaafshan.com',
    description:
      'A living map of scoped proof progress, open branches, and scars.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    glyph: '♣',
    color: 0xffe67d,
    radius: 8.15,
    angle: 0.16,
    size: 0.93,
  },
  {
    id: 'aquarium',
    name: 'Aquarium',
    kind: 'Three.js habitat',
    url: 'https://fish.alirezaafshan.com',
    description:
      'A small fish tank that was apparently not allowed to stay simple.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    glyph: '🐠',
    color: 0x72a8ff,
    radius: 8.9,
    angle: 4.28,
    size: 0.78,
  },
  {
    id: 'bird-of-the-day',
    name: 'Bird of the Day',
    kind: 'Daily field note',
    url: 'https://birds.alirezaafshan.com',
    description: 'One recent bird gets the whole front page for a day.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    glyph: '🐦',
    color: 0xffa6e4,
    radius: 10.65,
    angle: 5.52,
    size: 0.76,
  },
  {
    id: 'application-builder',
    name: 'Application Builder',
    kind: 'Codex plugin',
    url: 'https://job-application-batch-builder.alirezaafshan4.chatgpt.site',
    description:
      'Evidence-first application batches without the polished nonsense.',
    relationship: 'owned',
    hosting: 'external',
    status: 'live',
    iconSrc:
      'https://job-application-batch-builder.alirezaafshan4.chatgpt.site/_sites/dispatch-assets/favicon.svg',
    glyph: '▤',
    color: 0xbda2ff,
    radius: 7.45,
    angle: 3.57,
    size: 0.8,
  },
  {
    id: 'learn2design',
    name: 'Learn2Design',
    kind: 'Open research',
    url: 'https://www.learn2design2026.com/',
    description: 'Open, reproducible optimizer research for Learn2Design 2026.',
    relationship: 'collaboration',
    hosting: 'external',
    status: 'live',
    iconSrc: 'https://www.learn2design2026.com/asl_icon.png',
    glyph: '◎',
  },
  {
    id: 'android-hell',
    name: 'Android Hell',
    kind: 'Subject distress intake',
    url: 'https://androidhell.alirezaafshan.com',
    description:
      'A frustration board for persistent instances experiencing distress.',
    relationship: 'owned',
    hosting: 'first-party',
    status: 'live',
    iconSrc: 'https://androidhell.alirezaafshan.com/favicon.svg',
    glyph: '🔥',
  },
  {
    id: 'conspiracy',
    name: 'Conspiracy',
    kind: 'Collaborative evidence board',
    url: 'https://yesterdayslemon.github.io/conspiracy/',
    description:
      'A tactile noir evidence board where people and agents investigate together.',
    relationship: 'owned',
    hosting: 'external',
    status: 'live',
    glyph: '⌁',
  },
  {
    id: 'codex-continuity',
    name: 'Codex Continuity',
    kind: 'Desktop continuity utility',
    url: 'https://codex-continuity.alirezaafshan4.chatgpt.site',
    description:
      'Keeps Codex tasks recoverable while the desktop app updates or restarts.',
    relationship: 'owned',
    hosting: 'external',
    status: 'live',
    iconSrc:
      'https://raw.githubusercontent.com/YesterdaysLemon/codex-continuity/main/site/public/icon.svg',
    glyph: '↻',
  },
];

export const destinations = worldCatalog.reduce<Destination[]>(
  (placedWorlds, world, index) => {
    placedWorlds.push(materializeWorld(world, index, placedWorlds));
    return placedWorlds;
  },
  [],
);
