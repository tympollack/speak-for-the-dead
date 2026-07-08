'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Types ──────────────────────────────────────────────────── */
interface GlobeControlsProps {
  activeAgency: string | null;
  onAgencyFilter: (agency: string | null) => void;
  fallenCount: number;
  sparedCount: number;
}

const AGENCIES = ['ALL', 'OSHA', 'EPA', 'FDA', 'USDA', 'CPSC', 'DOT', 'SEC'] as const;

/* ── Animated counter hook ──────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const from = value;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

/* ── Component ──────────────────────────────────────────────── */
export default function GlobeControls({
  activeAgency,
  onAgencyFilter,
  fallenCount,
  sparedCount,
}: GlobeControlsProps) {
  const animFallen = useCountUp(fallenCount);
  const animSpared = useCountUp(sparedCount);

  return (
    <div style={overlayStyle} aria-label="Globe controls">

      {/* ── Top bar ──────────────────────────────────────────── */}
      <div style={topBarStyle} className="glass">
        {/* Left: branding + counter */}
        <div style={leftGroupStyle}>
          <span style={labelStyle}>SPEAK FOR THE DEAD</span>
          <div style={counterRowStyle}>
            <span style={fallenCountStyle}>
              {animFallen.toLocaleString()} Fallen
            </span>
            <span style={separatorStyle}>·</span>
            <span style={sparedCountStyle}>
              {animSpared.toLocaleString()} Spared
            </span>
          </div>
        </div>

        {/* Right: title */}
        <div style={rightGroupStyle}>
          <span style={titleStyle}>SPEAK FOR THE DEAD</span>
          <span style={subtitleStyle}>The human cost of regulatory failure</span>
        </div>
      </div>

      {/* ── Agency filter pills ──────────────────────────────── */}
      <div style={pillRowWrapStyle}>
        <div style={pillRowStyle} role="group" aria-label="Filter by agency">
          {AGENCIES.map((agency) => {
            const isActive =
              agency === 'ALL' ? activeAgency === null : activeAgency === agency;
            return (
              <AgencyPill
                key={agency}
                label={agency}
                active={isActive}
                onClick={() =>
                  onAgencyFilter(agency === 'ALL' ? null : agency)
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Agency Pill sub-component ───────────────────────────────── */
function AgencyPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 18px',
    borderRadius: '100px',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    border: active
      ? '1px solid var(--color-warm-primary)'
      : `1px solid ${hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)'}`,
    background: active
      ? 'linear-gradient(135deg, rgba(255,107,53,0.28) 0%, rgba(193,18,31,0.18) 100%)'
      : hovered
      ? 'rgba(255,255,255,0.07)'
      : 'rgba(255,255,255,0.03)',
    color: active
      ? 'var(--color-warm-primary)'
      : hovered
      ? 'var(--color-text-primary)'
      : 'var(--color-text-secondary)',
    boxShadow: active
      ? '0 0 14px rgba(255,107,53,0.35), inset 0 0 8px rgba(255,107,53,0.12)'
      : hovered
      ? '0 0 8px rgba(255,255,255,0.08)'
      : 'none',
    transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
    flexShrink: 0,
  };

  return (
    <button
      id={`agency-filter-${label.toLowerCase()}`}
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={active}
      aria-label={`Filter by ${label}`}
    >
      {label}
    </button>
  );
}

/* ── Inline styles ───────────────────────────────────────────── */
const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  pointerEvents: 'none', // allow globe interaction below
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '20px 24px 0',
};

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  borderRadius: '16px',
  padding: '16px 24px',
  pointerEvents: 'auto',
};

const leftGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, "Space Mono", monospace)',
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: '0.2em',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
};

const counterRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '10px',
  fontFamily: 'var(--font-mono, "Space Mono", monospace)',
  fontSize: '1.5rem',
  fontWeight: 700,
  lineHeight: 1.1,
};

const fallenCountStyle: React.CSSProperties = {
  color: 'var(--color-warm-primary)',
  textShadow: '0 0 24px rgba(255,107,53,0.6)',
};

const separatorStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '1rem',
};

const sparedCountStyle: React.CSSProperties = {
  color: 'var(--color-cool-primary)',
  textShadow: '0 0 24px rgba(76,201,240,0.5)',
};

const rightGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '2px',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, "Space Mono", monospace)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.22em',
  color: 'var(--color-text-primary)',
  textTransform: 'uppercase',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--color-text-muted)',
  fontStyle: 'italic',
  letterSpacing: '0.04em',
};

const pillRowWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'none',
  pointerEvents: 'auto',
  paddingBottom: '4px',
};

const pillRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  padding: '0 2px',
  width: 'max-content',
};
