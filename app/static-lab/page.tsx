import type { Metadata } from 'next';
import { StaticLab } from '@/components/static-lab';
import './static-lab.css';

export const metadata: Metadata = {
  title: "Static lab · Alireza's Galaxy",
  description: 'An experimental workbench for comms static effects.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/static-lab' },
};

export default function StaticLabPage() {
  return <StaticLab />;
}
