import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ShareButton from './ShareButton';

interface StoryPageProps {
  // Next.js 16: params is a Promise — must be awaited
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('stories')
    .select('pull_quote, incident_outcome')
    .eq('id', id)
    .eq('moderation_status', 'APPROVED')
    .single();

  if (!data) return { title: 'Story Not Found | Speak for the Dead' };

  return {
    title: 'A Story | Speak for the Dead',
    description: data.pull_quote ?? 'A story from Speak for the Dead.',
    openGraph: {
      description: data.pull_quote ?? undefined,
      type: 'article',
    },
  };
}

const OUTCOME_COLORS: Record<string, string> = {
  FATALITY: 'var(--color-warm-secondary, #C1121F)',
  INJURY:   'var(--color-warm-primary, #FF6B35)',
  ILLNESS:  '#E07A3A',
  NEAR_MISS:'var(--color-cool-primary, #4CC9F0)',
  SPARED:   'var(--color-cool-primary, #4CC9F0)',
};

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: story } = await supabase
    .from('stories')
    .select(`
      id, pull_quote, narrative, incident_outcome,
      preventability_score, verification_tier, created_at,
      story_analysis_tags ( agency_code, regulations ( name ) )
    `)
    .eq('id', id)
    .eq('moderation_status', 'APPROVED')
    .single();

  if (!story) notFound();

  const isSpared = story.incident_outcome === 'SPARED' || story.incident_outcome === 'NEAR_MISS';
  const accentColor = OUTCOME_COLORS[story.incident_outcome] ?? 'var(--color-warm-primary)';
  const formattedDate = new Date(story.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Flatten agency tags
  const tags = (story.story_analysis_tags ?? []) as Array<{ agency_code: string }>;
  const agencies = [...new Set(tags.map((t) => t.agency_code).filter(Boolean))];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0A0A0F 0%, #0F0F17 100%)',
      padding: '0 20px 60px',
    }}>
      {/* Top accent bar */}
      <div style={{ height: '3px', background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Nav */}
      <nav style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 0' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: '0.875rem', letterSpacing: '0.05em' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 12L4 7l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Speak for the Dead
        </Link>
      </nav>

      {/* Story card */}
      <article style={{ maxWidth: '760px', margin: '0 auto' }}>

        {/* Verification badge */}
        {story.verification_tier === 'ANCHOR' && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 14px', borderRadius: '99px',
            border: '1px solid var(--color-cool-primary, #4CC9F0)',
            color: 'var(--color-cool-primary, #4CC9F0)',
            fontSize: '0.78rem', fontWeight: 500, letterSpacing: '0.05em',
            marginBottom: '24px',
          }}>
            ⚓ Anchor Story · Document Verified
          </div>
        )}

        {/* Pull quote */}
        <blockquote style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontStyle: 'italic',
          fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          lineHeight: 1.65,
          color: '#ffffff',
          margin: '0 0 36px',
          paddingLeft: '24px',
          borderLeft: `4px solid ${accentColor}`,
        }}>
          &ldquo;{story.pull_quote}&rdquo;
        </blockquote>

        {/* Meta badges row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '32px' }}>
          {/* Outcome */}
          <span style={{
            padding: '5px 14px', borderRadius: '99px',
            background: isSpared ? 'rgba(76,201,240,0.1)' : 'rgba(255,107,53,0.1)',
            border: `1px solid ${accentColor}`,
            color: accentColor, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em',
          }}>
            {story.incident_outcome.replace('_', ' ')}
          </span>

          {/* Agencies */}
          {agencies.map((a) => (
            <span key={a} style={{
              padding: '5px 14px', borderRadius: '99px',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem',
            }}>
              {a}
            </span>
          ))}

          {/* Date */}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginLeft: 'auto' }}>
            {formattedDate}
          </span>
        </div>

        {/* Preventability bar */}
        {story.preventability_score != null && (
          <div style={{ marginBottom: '36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', letterSpacing: '0.04em' }}>PREVENTABILITY</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 600 }}>{story.preventability_score}/10</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                width: `${(story.preventability_score / 10) * 100}%`,
                background: `linear-gradient(90deg, ${accentColor}, ${isSpared ? '#4CC9F0' : '#C1121F'})`,
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
        )}

        {/* Narrative */}
        <div className="glass" style={{
          padding: '32px',
          borderRadius: '16px',
          marginBottom: '32px',
        }}>
          <h2 style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '20px' }}>
            THEIR STORY
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: '1rem',
            lineHeight: 1.8,
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>
            {story.narrative}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <ShareButton storyId={story.id} />
          <Link href="/submit" style={{
            color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}>
            Add your own story
          </Link>
        </div>
      </article>
    </div>
  );
}
