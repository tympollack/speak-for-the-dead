'use client';

/**
 * GlobeSection — client component wrapper for the TruthEngineGlobe.
 *
 * Next.js 16 (Turbopack) disallows `ssr: false` in Server Components.
 * This thin wrapper moves the dynamic import into a client boundary so
 * the WebGL globe can be loaded without SSR.
 */

import dynamic from 'next/dynamic';
import GlobeLoader from './GlobeLoader';
import type { GlobeParticle } from './GlobeParticles';

const TruthEngineGlobe = dynamic(
  () => import('./TruthEngineGlobe'),
  { ssr: false, loading: () => <GlobeLoader /> }
);

interface GlobeSectionProps {
  particles: GlobeParticle[];
}

export default function GlobeSection({ particles }: GlobeSectionProps) {
  return <TruthEngineGlobe particles={particles} />;
}
