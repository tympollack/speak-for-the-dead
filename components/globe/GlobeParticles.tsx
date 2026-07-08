'use client';

import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Types ──────────────────────────────────────────────────── */
export interface GlobeParticle {
  outcome_type: 0 | 1;
  agency_codes: string[];
  is_anchor: boolean;
}

interface GlobeParticlesProps {
  particles: GlobeParticle[];
  activeAgency: string | null;
  onParticleHover: (index: number, is_anchor: boolean) => void;
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
  outcome_type: 0 | 1,
  is_anchor: boolean
): [number, number, number] {
  const boost = is_anchor ? 1.3 : 1.0;
  if (outcome_type === 0) {
    // Fallen (FATALITY/INJURY/ILLNESS) -> Warm Red/Orange
    return [1.0 * boost, 0.45 * boost, 0.2 * boost];
  } else {
    // Spared (SPARED/NEAR_MISS) -> Cool Blue/Cyan
    return [0.25 * boost, 0.77 * boost, 0.94 * boost];
  }
}

/* ── Component ──────────────────────────────────────────────── */
export default function GlobeParticles({
  particles,
  activeAgency,
  onParticleHover,
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
        // Column layout: shift right
        const clusterRand = seededRandom(i * 99991 + 3);
        const radius = clusterRand() * 0.35;
        const theta = clusterRand() * Math.PI * 2;
        const y = (clusterRand() - 0.5) * 1.5; // spanning -0.75 to 0.75

        arr[i * 3]     = Math.cos(theta) * radius + 1.0;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.sin(theta) * radius;
      } else {
        // Globe layout: shift left (keep normal size, don't expand too much if side-by-side)
        arr[i * 3]     = bx * 0.85 - 1.0;
        arr[i * 3 + 1] = by * 0.85;
        arr[i * 3 + 2] = bz * 0.85;
      }
    }
    return arr;
  }, [activeAgency, count, particles, scatteredPositions]);

  /* ── Target Opacities ────────────────────────────────────── */
  const targetOpacities = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      if (!activeAgency) {
        arr[i] = 1.0;
      } else {
        const matches = p.agency_codes.includes(activeAgency);
        arr[i] = matches ? 1.0 : 0.1;
      }
    }
    return arr;
  }, [activeAgency, count, particles]);

  /* ── Colors ─────────────────────────────────────────────── */
  const colors = useMemo<Float32Array>(() => {
    // We use an RGBA buffer (4 values per particle)
    const arr = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const [r, g, b] = outcomeColor(p.outcome_type, p.is_anchor);
      arr[i * 4]     = Math.min(r, 1.0);
      arr[i * 4 + 1] = Math.min(g, 1.0);
      arr[i * 4 + 2] = Math.min(b, 1.0);
      arr[i * 4 + 3] = 1.0; // Initial alpha
    }
    return arr;
  }, [count, particles]);

  /* ── Sizes ───────────────────────────────────────────────── */
  const sizes = useMemo<Float32Array>(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      arr[i] = p.is_anchor ? 0.045 : (p.outcome_type === 0 ? 0.038 : 0.032);
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

  /* ── Animation loop: lerp toward target positions and opacities ─── */
  useFrame(() => {
    if (!pointsRef.current) return;
    const curPos = positionsRef.current;
    const tgtPos = targetRef.current;
    const geo = pointsRef.current.geometry as THREE.BufferGeometry;
    
    // Lerp positions
    let posDirty = false;
    if (curPos && tgtPos && curPos.length === tgtPos.length) {
      for (let i = 0; i < curPos.length; i++) {
        const delta = tgtPos[i] - curPos[i];
        if (Math.abs(delta) > 0.0001) {
          curPos[i] += delta * 0.05;
          posDirty = true;
        }
      }
      if (posDirty) {
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
        posAttr.set(curPos);
        posAttr.needsUpdate = true;
        geo.computeBoundingSphere();
      }
    }

    // Lerp opacities
    let colorDirty = false;
    const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const curColors = colorAttr.array as Float32Array;
    if (curColors && curColors.length === count * 4) {
      for (let i = 0; i < count; i++) {
        const curAlpha = curColors[i * 4 + 3];
        const tgtAlpha = targetOpacities[i];
        const deltaAlpha = tgtAlpha - curAlpha;
        
        if (Math.abs(deltaAlpha) > 0.001) {
          curColors[i * 4 + 3] += deltaAlpha * 0.05;
          colorDirty = true;
        }
      }
      if (colorDirty) {
        colorAttr.needsUpdate = true;
      }
    }
  });

  /* ── Debounced Hover Handling ────────────────────────────── */
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const lastRaycast = useRef<number>(0);

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const onPointerMove = (e: MouseEvent) => {
      // Throttle raycaster to max once every 100ms
      const now = performance.now();
      if (now - lastRaycast.current < 100) return;
      lastRaycast.current = now;

      if (!pointsRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / size.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / size.height) * 2 + 1;
      
      // Fix massive default threshold to avoid picking on empty space, but keep it large enough to click easily
      if (raycaster.params.Points) {
        raycaster.params.Points.threshold = 0.05;
      }
      
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hits = raycaster.intersectObject(pointsRef.current);
      
      if (hits.length > 0 && hits[0].index !== undefined) {
        const idx = hits[0].index;
        const p = particles[idx];
        
        // Bail out if we are intersecting an invisible (inactive) dot
        if (activeAgency && !p.agency_codes.includes(activeAgency)) {
          document.body.style.cursor = 'auto';
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          return;
        }

        // Visual blip immediately (pointer cursor)
        document.body.style.cursor = 'pointer';
        const isAnchor = p.is_anchor;

        // Clear existing debounce
        if (hoverTimer.current) clearTimeout(hoverTimer.current);

        // Wait for mouse to settle
        hoverTimer.current = setTimeout(() => {
          onParticleHover(idx, isAnchor);
        }, 200);
      } else {
        document.body.style.cursor = 'auto';
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
      }
    };

    canvas.addEventListener('pointermove', onPointerMove);
    return () => canvas.removeEventListener('pointermove', onPointerMove);
  }, [camera, onParticleHover, particles, raycaster, size]);

  if (count === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry key={count}>
        <bufferAttribute
          attach="attributes-position"
          args={[positionsRef.current.length > 0 ? positionsRef.current : scatteredPositions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 4]}
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
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
