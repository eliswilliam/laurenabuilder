import { Metadata } from 'next';
import LandingPageClient from '@/components/Landing/LandingPageClient';

export const metadata: Metadata = {
  title: 'Laurena Builder',
  description:
    'AI website builder: chat, generate and publish from a single conversation.',
};

export default function LandingPage() {
  return <LandingPageClient />;
}
