'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Types ──────────────────────────────────────────────────── */
export interface GlobeParticle {
  id: string;
  incident_outcome: 'FATALITY' | 'INJURY' | 'ILLNESS' | 'NEAR_MISS' | 'SPARED';
  agency_codes: string[];
  preventability_score: number;
  pull_quote: string;
  is_verified: boolean;
}

interface GlobeParticlesProps {
  particles: GlobeParticle[];
  activeAgency: string | null;
  onParticleClick: (particle: { id: string; pull_quote: string }) => void;
}

/* ── Seeded pseudo-random (mulberry32) ──────────────────────── */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Random point on unit sphere surface ────────────────────── */
function randomSpherePoint(rand: () => number): [number, number, number] {
  const theta = rand() * Math.PI * 2;
  const phi = Math.acos(2 * rand() - 1);
  return [
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  ];
}

/* ── Color per outcome ──────────────────────────────────────── */
function outcomeColor(
  outcome: GlobeParticle['incident_outcome'],
  isVerified: boolean
): [number, number, number] {
  const boost = isVerified ? 1.15 : 1.0;
  switch (outcome) {
    case 'FATALITY':
      return [1.0 * boost, 0.35 * boost, 0.15 * boost];
    case 'INJURY':
      return [1.0 * boost, 0.55 * boost, 0.2 * boost];
    case 'ILLNESS':
      return [0.9 * boost, 0.42 * boost, 0.22 * boost];
    case 'NEAR_MISS':
      return [0.3 * boost, 0.75 * boost, 0.94 * boost];
    case 'SPARED':
      return [0.2 * boost, 0.79 * boost, 0.94 * boost];
  }
}

/* ── Component ──────────────────────────────────────────────── */
export default function GlobeParticles({
  particles,
  activeAgency,
  onParticleClick,
}: GlobeParticlesProps) {
  const { raycaster, camera, size } = useThree();
  const pointsRef = useRef<THREE.Points>(null!);
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const targetRef = useRef<Float32Array>(new Float32Array(0));

  const count = particles.length;

  /* ── Scattered positions (stable, index-seeded) ─────────── */
  const scatteredPositions = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const rand = seededRandom(i * 31337 + 7);
      const [x, y, z] = randomSpherePoint(rand);
      arr[i * 3]     = x * 0.85;
      arr[i * 3 + 1] = y * 0.85;
      arr[i * 3 + 2] = z * 0.85;
    }
    return arr;
  }, [count]);

  /* ── Clustered positions (agency filter active) ──────────── */
  const clusteredPositions = useMemo<Float32Array>(() => {
    if (!activeAgency) return scatteredPositions;

    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const matches = p.agency_codes.includes(activeAgency);
      const rand = seededRandom(i * 31337 + 13);
      const [bx, by, bz] = randomSpherePoint(rand);

      if (matches) {
        // Cluster into front hemisphere, tight sphere sector
        const clusterRand = seededRandom(i * 99991 + 3);
        const theta = (clusterRand() - 0.5) * Math.PI * 0.6;
        const phi = clusterRand() * Math.PI * 0.5;
        arr[i * 3]     = Math.sin(phi) * Math.cos(theta) * 0.92;
        arr[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * 0.92;
        arr[i * 3 + 2] = Math.abs(Math.cos(phi)) * 0.92 + 0.08;
      } else {
        // Push non-matching to back hemisphere
        arr[i * 3]     = bx;
        arr[i * 3 + 1] = by;
        arr[i * 3 + 2] = -Math.abs(bz) - 0.05;
      }
    }
    return arr;
  }, [activeAgency, count, particles, scatteredPositions]);

  /* ── Colors ─────────────────────────────────────────────── */
  const colors = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const [r, g, b] = outcomeColor(particles[i].incident_outcome, particles[i].is_verified);
      arr[i * 3]     = Math.min(r, 1.0);
      arr[i * 3 + 1] = Math.min(g, 1.0);
      arr[i * 3 + 2] = Math.min(b, 1.0);
    }
    return arr;
  }, [count, particles]);

  /* ── Sizes (fatalities slightly larger) ──────────────────── */
  const sizes = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      arr[i] =
        p.incident_outcome === 'FATALITY' ? 0.045 :
        p.is_verified ? 0.038 :
        0.035;
    }
    return arr;
  }, [count, particles]);

  /* ── Sync current & target refs on mount / filter change ─── */
  useEffect(() => {
    if (positionsRef.current.length !== count * 3) {
      positionsRef.current = new Float32Array(scatteredPositions);
    }
    targetRef.current = clusteredPositions;
  }, [clusteredPositions, count, scatteredPositions]);

  /* ── Animation loop: lerp toward target ─────────────────── */
  useFrame(() => {
    if (!pointsRef.current) return;
    const cur = positionsRef.current;
    const tgt = targetRef.current;
    if (!cur || !tgt || cur.length !== tgt.length) return;

    let dirty = false;
    for (let i = 0; i < cur.length; i++) {
      const delta = tgt[i] - cur[i];
      if (Math.abs(delta) > 0.0001) {
        cur[i] += delta * 0.05;
        dirty = true;
      }
    }

    if (dirty) {
      const geo = pointsRef.current.geometry as THREE.BufferGeometry;
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      attr.set(cur);
      attr.needsUpdate = true;
    }
  });

  /* ── Click handling via raycaster ────────────────────────── */
  const handleClick = useCallback(
    (e: { nativeEvent: MouseEvent }) => {
      if (!pointsRef.current) return;
      const rect = (e.nativeEvent.target as HTMLElement).getBoundingClientRect();
      const ndcX = ((e.nativeEvent.clientX - rect.left) / size.width) * 2 - 1;
      const ndcY = -((e.nativeEvent.clientY - rect.top) / size.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObject(pointsRef.current);
      if (hits.length > 0 && hits[0].index !== undefined) {
        const idx = hits[0].index;
        if (idx < particles.length) {
          onParticleClick({
            id: particles[idx].id,
            pull_quote: particles[idx].pull_quote,
          });
        }
      }
    },
    [camera, onParticleClick, particles, raycaster, size]
  );

  if (count === 0) return null;

  return (
    <points ref={pointsRef} onClick={handleClick}>
      <bufferGeometry key={count}>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current.length > 0 ? positionsRef.current : scatteredPositions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.035}
        sizeAttenuation
        transparent
        opacity={1.0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
