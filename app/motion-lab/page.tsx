import type { Metadata } from 'next';
import { MotionLab } from '@/components/motion-lab';
import './motion-lab.css';

export const metadata: Metadata = {
  title: "Motion lab · Alireza's Galaxy",
  description: 'An experimental workbench for galaxy interface motion.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/motion-lab' },
};

export default function MotionLabPage() {
  return <MotionLab />;
}
