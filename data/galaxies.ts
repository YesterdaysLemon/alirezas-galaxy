import { destinations, generateWorlds } from './worlds';
import { webring } from './webring';

export const galaxies = {
  home: { id: 'home', label: 'my galaxy', arms: 5, worlds: destinations },
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
