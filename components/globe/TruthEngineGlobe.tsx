'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { createClient } from '@/lib/supabase/client';
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
      if (p.outcome_type === 0) {
        fallen++;
      } else {
        spared++;
      }
    }
    return { fallenCount: fallen, sparedCount: spared };
  }, [particles]);

  /* ── Pre-fetched Pools & Session Locking ────────────────── */
  const sessionLocks = useRef<Map<number, { id: string; pull_quote: string }>>(new Map());
  const anchorPool = useRef<{ id: string; pull_quote: string }[]>([]);
  const unverifiedPool = useRef<{ id: string; pull_quote: string }[]>([]);

  useEffect(() => {
    const fetchPool = async () => {
      const supabase = createClient();
      let fetchedData: any[] | null = null;

      if (activeAgency) {
        const { data } = await supabase
          .from('stories')
          .select('id, pull_quote, verification_tier, story_analysis_tags!inner(agency_code)')
          .eq('moderation_status', 'APPROVED')
          .eq('story_analysis_tags.agency_code', activeAgency)
          .order('created_at', { ascending: false })
          .limit(100);
        fetchedData = data;
      } else {
        const { data } = await supabase
          .from('stories')
          .select('id, pull_quote, verification_tier')
          .eq('moderation_status', 'APPROVED')
          .order('created_at', { ascending: false })
          .limit(100);
        fetchedData = data;
      }

      if (fetchedData) {
        anchorPool.current = [];
        unverifiedPool.current = [];
        fetchedData.forEach(d => {
          const item = { id: d.id, pull_quote: d.pull_quote || 'A story from Speak for the Dead.' };
          if (d.verification_tier === 'ANCHOR') {
            anchorPool.current.push(item);
          } else {
            unverifiedPool.current.push(item);
          }
        });
      }
    };
    fetchPool();
  }, [activeAgency]);

  const handleParticleHover = useCallback((index: number, is_anchor: boolean) => {
    // 1. Check if already session locked
    if (sessionLocks.current.has(index)) {
      setSelectedParticle(sessionLocks.current.get(index)!);
      return;
    }

    // 2. Otherwise pop from pools
    let nextStory = null;
    if (is_anchor && anchorPool.current.length > 0) {
      nextStory = anchorPool.current.shift();
    } else if (unverifiedPool.current.length > 0) {
      nextStory = unverifiedPool.current.shift();
    } else if (anchorPool.current.length > 0) {
      nextStory = anchorPool.current.shift();
    }

    // 3. Lock it permanently for this session
    if (nextStory) {
      sessionLocks.current.set(index, nextStory);
      setSelectedParticle(nextStory);
    }
  }, []);

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
          onParticleHover={handleParticleHover}
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
