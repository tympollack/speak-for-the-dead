'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import Link from 'next/link';
import GlobeControls from './GlobeControls';
import type { GlobeParticle } from './GlobeParticles';

// Dynamically import GlobeParticles with ssr: false because it uses WebGL
// NOTE: ssr:false must be inside a Client Component (this file is 'use client').
const GlobeParticles = dynamic(() => import('./GlobeParticles'), { ssr: false });

/* ── Props ──────────────────────────────────────────────────── */
interface TruthEngineGlobeProps {
  particles: GlobeParticle[];
}

/* ── Component ──────────────────────────────────────────────── */
export default function TruthEngineGlobe({ particles }: TruthEngineGlobeProps) {
  const [activeAgency, setActiveAgency] = useState<string | null>(null);
  const [selectedParticle, setSelectedParticle] = useState<{
    id: string;
    pull_quote: string;
  } | null>(null);

  /* ── Counts ─────────────────────────────────────────────── */
  const { fallenCount, sparedCount } = useMemo(() => {
    let fallen = 0;
    let spared = 0;
    for (const p of particles) {
      if (
        p.incident_outcome === 'FATALITY' ||
        p.incident_outcome === 'INJURY' ||
        p.incident_outcome === 'ILLNESS'
      ) {
        fallen++;
      } else {
        spared++;
      }
    }
    return { fallenCount: fallen, sparedCount: spared };
  }, [particles]);

  return (
    <div style={wrapperStyle}>
      {/* ── HUD overlay ─────────────────────────────────────── */}
      <GlobeControls
        activeAgency={activeAgency}
        onAgencyFilter={setActiveAgency}
        fallenCount={fallenCount}
        sparedCount={sparedCount}
      />

      {/* ── WebGL Canvas ─────────────────────────────────────── */}
      <Canvas
        camera={{ position: [0, 0, 3], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1.2} color="#FF6B35" />
        <pointLight position={[-5, -5, -5]} intensity={0.6} color="#4CC9F0" />

        {/* Globe wire-sphere */}
        <GlobeWireSphere />

        {/* Particles */}
        <GlobeParticles
          particles={particles}
          activeAgency={activeAgency}
          onParticleClick={setSelectedParticle}
        />

        {/* Camera controls */}
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={8}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.07}
        />

        {/* Post-processing */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.05}
            luminanceSmoothing={0.9}
            intensity={2.5}
          />
        </EffectComposer>
      </Canvas>

      {/* ── Particle tooltip ──────────────────────────────────── */}
      {selectedParticle && (
        <div style={tooltipStyle} className="glass">
          {/* Quote */}
          <p className="text-playfair" style={quoteStyle}>
            &ldquo;{selectedParticle.pull_quote}&rdquo;
          </p>

          {/* Actions */}
          <div style={tooltipActionsStyle}>
            <Link
              href={`/story/${selectedParticle.id}`}
              style={readMoreStyle}
              id={`story-link-${selectedParticle.id}`}
            >
              Read their story&nbsp;→
            </Link>
            <button
              style={closeStyle}
              onClick={() => setSelectedParticle(null)}
              aria-label="Close"
              id="tooltip-close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Wire sphere (globe outline) ─────────────────────────────── */
function GlobeWireSphere() {
  return (
    <mesh>
      <sphereGeometry args={[1, 36, 36]} />
      <meshBasicMaterial
        color="#1a1a2e"
        wireframe
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

/* ── Styles ──────────────────────────────────────────────────── */
const wrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100vh',
  overflow: 'hidden',
};

const tooltipStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '10%',
  left: '50%',
  transform: 'translateX(-50%)',
  maxWidth: '520px',
  width: 'calc(100% - 48px)',
  borderRadius: '20px',
  padding: '28px 32px',
  zIndex: 20,
  animation: 'fadeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 0 60px rgba(255,107,53,0.15), 0 8px 32px rgba(0,0,0,0.6)',
  pointerEvents: 'auto',
};

const quoteStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  lineHeight: 1.75,
  color: 'var(--color-text-primary, #F0EEE9)',
  fontStyle: 'italic',
  marginBottom: '20px',
  letterSpacing: '0.01em',
};

const tooltipActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const readMoreStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--color-warm-primary, #FF6B35)',
  letterSpacing: '0.03em',
  transition: 'opacity 150ms ease',
  textDecoration: 'none',
};

const closeStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '50%',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.2rem',
  color: 'var(--color-text-secondary, #A8A6A0)',
  cursor: 'pointer',
  transition: 'background 150ms ease',
  flexShrink: 0,
};
