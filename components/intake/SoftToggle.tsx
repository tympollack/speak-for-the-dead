'use client';

import { motion } from 'framer-motion';

type StoryType = 'IN_MEMORIAM' | 'NEAR_MISS';

interface SoftToggleProps {
  value: StoryType;
  onChange: (v: StoryType) => void;
}

const CandleIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <ellipse cx="18" cy="28" rx="5" ry="2" fill="rgba(255,107,53,0.2)" />
    <rect x="14" y="14" width="8" height="14" rx="2" fill="#C1121F" />
    <rect x="15.5" y="14" width="5" height="14" rx="1.5" fill="#FF6B35" opacity="0.6" />
    {/* Flame */}
    <path
      d="M18 13 C18 13 15 10 16 7 C16.5 5.5 17 4 18 3 C19 4 19.5 5.5 20 7 C21 10 18 13 18 13Z"
      fill="url(#flame-gradient)"
    />
    <path
      d="M18 12 C18 12 16.5 10 17 8 C17.3 6.8 17.7 6 18 5.5 C18.3 6 18.7 6.8 19 8 C19.5 10 18 12 18 12Z"
      fill="#FFEAA7"
      opacity="0.8"
    />
    <defs>
      <linearGradient id="flame-gradient" x1="18" y1="3" x2="18" y2="13" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FFEAA7" />
        <stop offset="50%" stopColor="#FF9F1C" />
        <stop offset="100%" stopColor="#FF6B35" />
      </linearGradient>
    </defs>
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M18 4L6 9V18C6 24.6 11.4 30.7 18 32C24.6 30.7 30 24.6 30 18V9L18 4Z"
      fill="url(#shield-gradient)"
    />
    <path
      d="M18 8L10 12V18C10 22.8 13.5 27.2 18 28.5C22.5 27.2 26 22.8 26 18V12L18 8Z"
      fill="rgba(76, 201, 240, 0.2)"
    />
    <path
      d="M15 18L17 20L21.5 15.5"
      stroke="#4CC9F0"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="shield-gradient" x1="6" y1="4" x2="30" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4CC9F0" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#7B2FBE" stopOpacity="0.4" />
      </linearGradient>
    </defs>
  </svg>
);

export default function SoftToggle({ value, onChange }: SoftToggleProps) {
  const options: {
    id: StoryType;
    icon: React.ReactNode;
    label: string;
    subtitle: string;
    glow: string;
    border: string;
    bg: string;
    selectedBg: string;
  }[] = [
    {
      id: 'IN_MEMORIAM',
      icon: <CandleIcon />,
      label: 'In Memoriam',
      subtitle: 'For a life taken by negligence',
      glow: 'var(--shadow-glow-warm)',
      border: 'var(--color-warm-border)',
      bg: 'rgba(255, 107, 53, 0.03)',
      selectedBg: 'rgba(255, 107, 53, 0.08)',
    },
    {
      id: 'NEAR_MISS',
      icon: <ShieldIcon />,
      label: 'A Near Miss',
      subtitle: 'For a life protected by regulation',
      glow: 'var(--shadow-glow-cool)',
      border: 'var(--color-cool-border)',
      bg: 'rgba(76, 201, 240, 0.03)',
      selectedBg: 'rgba(76, 201, 240, 0.08)',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        width: '100%',
      }}
      role="radiogroup"
      aria-label="Story type"
    >
      {options.map((opt) => {
        const isSelected = value === opt.id;
        return (
          <motion.button
            key={opt.id}
            id={`toggle-${opt.id}`}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.id)}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '32px 24px',
              borderRadius: 'var(--radius-lg)',
              border: `1.5px solid ${isSelected ? opt.border : 'var(--color-border)'}`,
              background: isSelected ? opt.selectedBg : opt.bg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isSelected ? opt.glow : 'none',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all var(--transition-normal)',
              outline: 'none',
              minHeight: '160px',
            }}
          >
            <motion.div
              animate={isSelected ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              {opt.icon}
            </motion.div>

            <div>
              <p
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: isSelected
                    ? opt.id === 'IN_MEMORIAM'
                      ? 'var(--color-warm-primary)'
                      : 'var(--color-cool-primary)'
                    : 'var(--color-text-primary)',
                  marginBottom: '4px',
                  letterSpacing: '-0.01em',
                  transition: 'color var(--transition-normal)',
                }}
              >
                {opt.label}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}
              >
                {opt.subtitle}
              </p>
            </div>

            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background:
                    opt.id === 'IN_MEMORIAM'
                      ? 'var(--color-warm-primary)'
                      : 'var(--color-cool-primary)',
                }}
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
