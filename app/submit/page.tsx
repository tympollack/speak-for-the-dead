import type { Metadata } from 'next';
import Link from 'next/link';
import IntakeForm from '@/components/intake/IntakeForm';

export const metadata: Metadata = {
  title: 'Share a Story | Speak for the Dead',
  description: 'Add your story to Speak for the Dead. Anonymous, respectful, and designed for those who grieve.',
};

export default function SubmitPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--color-bg-deep, #0A0A0F) 0%, var(--color-bg-surface, #0F0F17) 100%)',
      position: 'relative',
    }}>
      {/* Subtle warm glow in corner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,107,53,0.3), transparent)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />

      {/* Back nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        padding: '20px 28px',
        zIndex: 10,
        display: 'flex', alignItems: 'center',
      }}>
        <Link href="/" style={{
          color: 'rgba(255,255,255,0.35)',
          textDecoration: 'none',
          fontSize: '0.875rem',
          letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'color 0.2s',
        }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 12L4 7l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Speak for the Dead
        </Link>
      </nav>

      {/* The form is the experience */}
      <main style={{ paddingTop: '70px' }}>
        <IntakeForm />
      </main>
    </div>
  );
}
