import type { Metadata } from 'next';
import { siteIdentity } from '@/data/site';

export const galaxyPlayerMetadata: Metadata = {
  twitter: {
    card: 'player',
    title: siteIdentity.name,
    description: siteIdentity.description,
    images: [
      {
        url: `${siteIdentity.origin}/player-preview.png`,
        alt: 'An interactive five-arm galaxy of stars leading to Alireza’s project worlds.',
      },
    ],
  },
  // Vinext's players descriptor requires a media stream. This player is HTML.
  other: {
    'twitter:player': `${siteIdentity.origin}/embed`,
    'twitter:player:width': '640',
    'twitter:player:height': '480',
  },
};
