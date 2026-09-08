export const staticEffects = [
  {
    id: 'S1',
    name: 'Crosshatch',
    description: 'The current woven signal. Crisp, mechanical, familiar.',
  },
  {
    id: 'S2',
    name: 'TV snow',
    description: 'Fine analog grain, like an untuned late-night television.',
  },
  {
    id: 'S3',
    name: 'Phosphor',
    description: 'Close horizontal scanlines with a soft moving sweep.',
  },
  {
    id: 'S4',
    name: 'Interference',
    description: 'Diagonal radio bands crossing through the carrier.',
  },
  {
    id: 'S5',
    name: 'Packet loss',
    description: 'Chunky digital fragments jumping between channels.',
  },
  {
    id: 'S6',
    name: 'Vertical hold',
    description: 'A rolling sync band over a quiet bed of noise.',
  },
  {
    id: 'S7',
    name: 'Crosshatch + hold',
    description: 'The woven crosshatch signal with a slow rolling sync band.',
  },
  {
    id: 'S8',
    name: 'TV snow + subtle hold',
    description:
      'Spore-inspired: fine TV grain, faint scanlines, and a gentle rolling band. Not an exact recreation.',
  },
] as const;

export type StaticEffectId = (typeof staticEffects)[number]['id'];
export const staticRevealDelay = (minimum: number, simulatedLoad: number) =>
  Math.max(minimum, simulatedLoad);
