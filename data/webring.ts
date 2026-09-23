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
    id: 'chatjimmy',
    name: 'ChatJimmy',
    url: 'https://chatjimmy.ai/',
    description: 'A little corner of the web for a chat with Jimmy.',
    kind: 'inspiration',
    iconSrc: 'https://chatjimmy.ai/favicon.ico',
    glyph: '✳',
  },
  {
    id: 'learn2design',
    name: 'Learn2Design',
    url: 'https://www.learn2design2026.com/',
    description: 'Open, reproducible optimizer research for Learn2Design 2026.',
    kind: 'collaboration',
    iconSrc: 'https://www.learn2design2026.com/asl_icon.png',
    glyph: '◎',
  },
  {
    id: 'ai-digest',
    name: 'AI Digest',
    url: 'https://theaidigest.org/',
    description:
      'Interactive explainers and demos exploring AI capabilities and the future.',
    kind: 'inspiration',
    iconSrc: 'https://theaidigest.org/favicon-96x96.png',
    glyph: '✦',
  },
  {
    id: 'moving-castles',
    name: 'Moving Castles',
    url: 'https://movingcastles.world/',
    description:
      'Experiments in AI character, including the Zero language model.',
    kind: 'inspiration',
    iconSrc: 'https://movingcastles.world/images/favicon.png',
    glyph: '△',
  },
  {
    id: 'superdark-factory',
    name: 'The Superdark Factory',
    url: 'https://superdark.antikythera.org/',
    description:
      "Antikythera's exploration of autonomous factories and their governance.",
    kind: 'inspiration',
    iconSrc: 'https://superdark.antikythera.org/favicon-32x32.png',
    glyph: '◇',
  },
];
