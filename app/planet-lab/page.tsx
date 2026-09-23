import type { Metadata } from 'next';
import { PlanetLab } from '@/components/planet-lab';
import './planet-lab.css';

export const metadata: Metadata = {
  title: "Planet lab · Alireza's Galaxy",
  description: 'A local workbench for tuning generated solar-system worlds.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/planet-lab' },
};

export default function PlanetLabPage() {
  return <PlanetLab />;
}
