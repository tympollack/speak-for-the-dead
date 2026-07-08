import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import GlobeSection from '@/components/globe/GlobeSection';

export const metadata: Metadata = {
  title: 'Speak for the Dead',
  description:
    'Every story is an evidence point. Every cluster is a systemic failure. The human cost of regulatory rollback, in real time.',
};



export default async function HomePage() {
  const supabase = await createClient();
  const { data: particles } = await supabase
    .from('globe_particles')
    .select('id, incident_outcome, pull_quote, preventability_score, verification_tier, agency_codes')
    .limit(2000);

  return (
    <>
      {/* Full-viewport globe — map DB verification_tier to the boolean GlobeParticle expects */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <GlobeSection particles={(particles ?? []).map((p) => ({
          ...p,
          is_verified: p.verification_tier === 'ANCHOR',
          agency_codes: Array.isArray(p.agency_codes) ? p.agency_codes : [],
        }))} />
      </div>

      {/* Ambient radial glow behind globe */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,107,53,0.04) 0%, transparent 70%)',
      }} />

      {/* Top title — fades into the globe */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2, pointerEvents: 'none',
        textAlign: 'center',
        opacity: 0.12,
      }}>
        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 5rem)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#ffffff',
          margin: 0,
          lineHeight: 1.1,
        }}>
          SPEAK FOR THE DEAD
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem', letterSpacing: '0.06em', marginTop: '12px' }}>
          THE HUMAN COST OF REGULATORY FAILURE, IN REAL TIME.
        </p>
      </div>

      {/* CTA — bottom center */}
      <div style={{
        position: 'fixed', bottom: '8%', left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10, textAlign: 'center',
      }}>
        {/* CTA button — hover via CSS class defined in globals.css */}
        <Link href="/submit" className="cta-btn">
          Add Your Story
        </Link>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginTop: '10px', letterSpacing: '0.05em' }}>
          Anonymous &middot; Zero friction &middot; One minute
        </p>
      </div>
    </>
  );
}
