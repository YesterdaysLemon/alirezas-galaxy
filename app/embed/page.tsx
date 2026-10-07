import { GalaxyIndex } from '@/components/galaxy-index';
import { galaxyPlayerMetadata } from './metadata';
import './embed.css';

export const metadata = {
  ...galaxyPlayerMetadata,
  robots: { index: false, follow: true },
};

export default function EmbeddedGalaxy() {
  return <GalaxyIndex embedded />;
}
