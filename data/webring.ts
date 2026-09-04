export type WebringNeighbor = {
  id: string;
  name: string;
  url: string;
  description: string;
  kind: 'friend' | 'collaboration' | 'inspiration';
  iconSrc?: string;
  glyph: string;
};

// A separate address book for other people's corners of the internet.
// Add a neighbor here; the distant-galaxy portal and machine-readable catalog
// use this same list. These entries never take a star in the home galaxy.
export const webring: WebringNeighbor[] = [
  {
    id: 'learn2design',
    name: 'Learn2Design',
    url: 'https://www.learn2design2026.com/',
    description: 'Open, reproducible optimizer research for Learn2Design 2026.',
    kind: 'collaboration',
    iconSrc: 'https://www.learn2design2026.com/asl_icon.png',
    glyph: '◎',
  },
];
