export type Destination = {
  name: string;
  kind: string;
  url: string;
  description: string;
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

function materializeWorld(world: WorldSeed, index: number): Destination {
  const identity = `${world.name}:${world.url}`;
  const radius = world.radius ?? 5.2 + hashUnit(identity, 11) * 5.8;
  const arm = index % GALAXY_ARMS;
  const armAngle = (arm / GALAXY_ARMS) * TAU;
  const armJitter = (hashUnit(identity, 29) - 0.5) * 0.34;

  return {
    ...world,
    color:
      world.color ??
      generatedColors[
        Math.floor(hashUnit(identity, 47) * generatedColors.length)
      ],
    radius,
    angle: world.angle ?? armAngle + radius * 0.49 + armJitter,
    size: world.size ?? 0.7 + hashUnit(identity, 71) * 0.24,
  };
}

// Add one object here to map a new website. Orbit, arm, color, and marker size
// are generated deterministically when omitted; supply any of them to art-direct
// a particularly important world. The first entry is the default homeworld.
const worldCatalog: WorldSeed[] = [
  {
    name: 'Alireza Afshan',
    kind: 'Portfolio · homeworld',
    url: 'https://portfolio.alirezaafshan.com',
    description: 'The person and the work at the center of this little galaxy.',
    iconSrc: 'https://alirezaafshan.com/apple-touch-icon.png',
    glyph: 'A♦',
    color: 0x70dfff,
    radius: 8.6,
    angle: 1.73,
    size: 1.22,
  },
  {
    name: 'C. elegans Lab',
    kind: 'Live simulation',
    url: 'https://worm.alirezaafshan.com',
    description:
      'A 302-neuron connectome and body running as one browser loop.',
    iconSrc:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M3 16C7 7 12 25 16 16s6-9 13 0' fill='none' stroke='%23e2a04a' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E",
    glyph: '〰',
    color: 0x9affeb,
    radius: 5.05,
    angle: 2.82,
    size: 0.86,
  },
  {
    name: 'Proof Bonsai',
    kind: 'Live research map',
    url: 'https://proof-bonsai.alirezaafshan.com',
    description:
      'A living map of scoped proof progress, open branches, and scars.',
    glyph: '♣',
    color: 0xffe67d,
    radius: 8.15,
    angle: 0.16,
    size: 0.93,
  },
  {
    name: 'Aquarium',
    kind: 'Three.js habitat',
    url: 'https://fish.alirezaafshan.com',
    description:
      'A small fish tank that was apparently not allowed to stay simple.',
    glyph: '🐠',
    color: 0x72a8ff,
    radius: 8.9,
    angle: 4.28,
    size: 0.78,
  },
  {
    name: 'Bird of the Day',
    kind: 'Daily field note',
    url: 'https://birds.alirezaafshan.com',
    description: 'One recent bird gets the whole front page for a day.',
    glyph: '🐦',
    color: 0xffa6e4,
    radius: 10.65,
    angle: 5.52,
    size: 0.76,
  },
  {
    name: 'Application Builder',
    kind: 'Codex plugin',
    url: 'https://job-application-batch-builder.alirezaafshan4.chatgpt.site',
    description:
      'Evidence-first application batches without the polished nonsense.',
    iconSrc:
      'https://job-application-batch-builder.alirezaafshan4.chatgpt.site/_sites/dispatch-assets/favicon.svg',
    glyph: '▤',
    color: 0xbda2ff,
    radius: 7.45,
    angle: 3.57,
    size: 0.8,
  },
  {
    name: 'Learn2Design',
    kind: 'Open research',
    url: 'https://www.learn2design2026.com/',
    description: 'Open, reproducible optimizer research for Learn2Design 2026.',
    iconSrc: 'https://www.learn2design2026.com/asl_icon.png',
    glyph: '◎',
  },
];

export const destinations = worldCatalog.map(materializeWorld);
