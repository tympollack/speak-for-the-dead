'use client';

import { useReducer, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { StoryAnalysis } from '@/lib/schemas/analysis.schema';
import SoftToggle from './SoftToggle';
import NarrativeStep from './NarrativeStep';
import GentleGuide from './GentleGuide';
import LexShadeUpload from './LexShadeUpload';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'TOGGLE' | 'NARRATIVE' | 'ANALYZING' | 'GUIDE' | 'UPLOAD' | 'CONFIRM' | 'SUCCESS';
type StoryType = 'IN_MEMORIAM' | 'NEAR_MISS';

interface FormState {
  step: Step;
  storyType: StoryType;
  narrative: string;
  followUpAnswers: Record<string, string>;
  storyAnalysis: StoryAnalysis | null;
  stagingId: string | null;
  userEmail: string;
  error: string | null;
  isSubmitting: boolean;
  submittedStoryId: string | null;
}

type Action =
  | { type: 'SET_STORY_TYPE'; payload: StoryType }
  | { type: 'SET_NARRATIVE'; payload: string }
  | { type: 'START_ANALYSIS' }
  | { type: 'ANALYSIS_SUCCESS'; payload: StoryAnalysis }
  | { type: 'ANALYSIS_ERROR'; payload: string }
  | { type: 'SET_FOLLOW_UP_ANSWERS'; payload: Record<string, string> }
  | { type: 'SET_STAGING_ID'; payload: string }
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; payload: string }
  | { type: 'SUBMIT_ERROR'; payload: string }
  | { type: 'NEXT_STEP' }
  | { type: 'CLEAR_ERROR' };

const initialState: FormState = {
  step: 'NARRATIVE',
  storyType: 'IN_MEMORIAM',
  narrative: '',
  followUpAnswers: {},
  storyAnalysis: null,
  stagingId: null,
  userEmail: '',
  error: null,
  isSubmitting: false,
  submittedStoryId: null,
};

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'SET_STORY_TYPE':
      return { ...state, storyType: action.payload };
    case 'SET_NARRATIVE':
      return { ...state, narrative: action.payload };
    case 'START_ANALYSIS':
      return { ...state, step: 'ANALYZING', error: null };
    case 'ANALYSIS_SUCCESS':
      return {
        ...state,
        step: 'GUIDE',
        storyAnalysis: action.payload,
        error: null,
      };
    case 'ANALYSIS_ERROR':
      return { ...state, step: 'NARRATIVE', error: action.payload };
    case 'SET_FOLLOW_UP_ANSWERS':
      return { ...state, followUpAnswers: action.payload };
    case 'SET_STAGING_ID':
      return { ...state, stagingId: action.payload };
    case 'SET_EMAIL':
      return { ...state, userEmail: action.payload };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, step: 'SUCCESS', isSubmitting: false, submittedStoryId: action.payload };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.payload };
    case 'NEXT_STEP': {
      const order: Step[] = ['NARRATIVE', 'ANALYZING', 'GUIDE', 'UPLOAD', 'CONFIRM', 'SUCCESS'];
      const currentIdx = order.indexOf(state.step);
      const next = order[currentIdx + 1] ?? state.step;
      return { ...state, step: next };
    }
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// ─── Step progress dots ────────────────────────────────────────────────────

const VISIBLE_STEPS: Step[] = ['TOGGLE', 'NARRATIVE', 'GUIDE', 'UPLOAD', 'CONFIRM'];

function StepDots({ current }: { current: Step }) {
  const idx = VISIBLE_STEPS.indexOf(current);
  if (idx < 0) return null;
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '40px' }}>
      {VISIBLE_STEPS.map((s, i) => (
        <div key={s} style={{
          width: i === idx ? '24px' : '8px',
          height: '8px',
          borderRadius: '4px',
          background: i <= idx ? 'var(--color-warm-primary)' : 'var(--color-border)',
          transition: 'all 0.35s ease',
        }} />
      ))}
    </div>
  );
}

// ─── Confirm step summary card ─────────────────────────────────────────────

function ConfirmStep({
  state,
  onEmailChange,
  onSubmit,
}: {
  state: FormState;
  onEmailChange: (e: string) => void;
  onSubmit: () => void;
}) {
  const analysis = state.storyAnalysis!;
  const tags = analysis.legal_tags;
  const metrics = analysis.truth_metrics;
  const isSpared = tags.incident_outcome === 'SPARED' || tags.incident_outcome === 'NEAR_MISS';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '600px', margin: '0 auto' }}>
      {/* Pull quote */}
      <div className="glass" style={{
        padding: '28px 32px',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '24px',
        borderLeft: `3px solid ${isSpared ? 'var(--color-cool-primary)' : 'var(--color-warm-primary)'}`,
      }}>
        <p style={{
          fontFamily: 'var(--font-playfair-var, "Playfair Display", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.15rem',
          lineHeight: 1.7,
          color: 'var(--color-text-primary)',
          margin: '0 0 12px',
        }}>
          &ldquo;{tags.pull_quote}&rdquo;
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
          — AI-generated summary · review before submitting
        </p>
      </div>

      {/* Extracted metadata badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '28px' }}>
        <Badge label="Agency" value={tags.agency_code} color="var(--color-text-secondary)" />
        <Badge label="Outcome" value={tags.incident_outcome} color={isSpared ? 'var(--color-cool-primary)' : 'var(--color-warm-primary)'} />
        <Badge label="Preventability" value={`${metrics.preventability_score}/10`} color="var(--color-text-secondary)" />
        {'negligent_party_name' in tags && (
          <Badge label="Party" value={tags.negligent_party_name} color="var(--color-text-secondary)" />
        )}
      </div>

      {/* Optional email */}
      <div style={{ marginBottom: '28px' }}>
        <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '8px' }}>
          Want to receive updates or edit this later? (Optional)
        </label>
        <input
          type="email"
          value={state.userEmail}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--color-bg-elevated, #1A1A24)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            color: 'var(--color-text-primary)',
            fontSize: '0.95rem',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {state.stagingId && (
        <p style={{ color: 'var(--color-cool-primary)', fontSize: '0.875rem', marginBottom: '20px' }}>
          ⚓ Anchor document attached · verification pending
        </p>
      )}

      <button
        className="btn-primary"
        onClick={onSubmit}
        disabled={state.isSubmitting}
        style={{ width: '100%', fontSize: '1rem', padding: '16px' }}
      >
        {state.isSubmitting ? 'Submitting…' : 'Submit Story'}
      </button>
    </motion.div>
  );
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '6px 14px',
      borderRadius: '99px',
      border: '1px solid var(--color-border)',
      background: 'rgba(255,255,255,0.03)',
      fontSize: '0.8rem',
    }}>
      <span style={{ color: 'var(--color-text-muted)', marginRight: '6px' }}>{label}</span>
      <span style={{ color, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function IntakeForm() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleContinueFromNarrative = useCallback(async () => {
    // Amendment 1: LLM fires ONLY here — never on blur, never debounced.
    dispatch({ type: 'START_ANALYSIS' });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: state.narrative,
          story_type: state.storyType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: 'ANALYSIS_ERROR', payload: data.message ?? 'Analysis failed. Please try again.' });
        return;
      }
      dispatch({ type: 'ANALYSIS_SUCCESS', payload: data });
    } catch {
      dispatch({ type: 'ANALYSIS_ERROR', payload: 'Something went wrong. Please check your connection and try again.' });
    }
  }, [state.narrative, state.storyType]);

  const handleSubmit = useCallback(async () => {
    if (!state.storyAnalysis) return;
    dispatch({ type: 'SUBMIT_START' });
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: state.narrative,
          story_type: state.storyType,
          follow_up_answers: state.followUpAnswers,
          stagingId: state.stagingId,
          userEmail: state.userEmail || undefined,
          storyAnalysis: state.storyAnalysis,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: 'SUBMIT_ERROR', payload: data.message ?? 'Submission failed. Please try again.' });
        return;
      }
      dispatch({ type: 'SUBMIT_SUCCESS', payload: data.story_id });
    } catch {
      dispatch({ type: 'SUBMIT_ERROR', payload: 'Something went wrong. Please try again.' });
    }
  }, [state]);

  const pageVariants: Variants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    exit:    { opacity: 0, x: -40, transition: { duration: 0.25 } },
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <StepDots current={state.step} />

      {state.error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          background: 'rgba(193,18,31,0.12)', border: '1px solid var(--color-warm-secondary)',
          borderRadius: 'var(--radius-md)', padding: '14px 20px',
          color: 'var(--color-warm-secondary)', fontSize: '0.9rem',
          marginBottom: '24px', maxWidth: '560px', width: '100%',
        }}>
          {state.error}
        </motion.div>
      )}

      <div style={{ width: '100%', maxWidth: '680px' }}>
        <AnimatePresence mode="wait">

          {state.step === 'NARRATIVE' && (
            <motion.div key="narrative" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <h1 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                Speak for the Dead
              </h1>
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '32px' }}>
                Every story is an evidence point.
              </p>
              
              <div style={{ marginBottom: '40px' }}>
                <SoftToggle value={state.storyType} onChange={(v) => dispatch({ type: 'SET_STORY_TYPE', payload: v })} />
              </div>

              <NarrativeStep
                storyType={state.storyType}
                value={state.narrative}
                onChange={(v) => dispatch({ type: 'SET_NARRATIVE', payload: v })}
                onContinue={handleContinueFromNarrative}
                isAnalyzing={false}
              />
            </motion.div>
          )}

          {state.step === 'ANALYZING' && (
            <motion.div key="analyzing" variants={pageVariants} initial="initial" animate="animate" exit="exit"
              style={{ textAlign: 'center', padding: '60px 20px' }}>
              {/* Pulse rings */}
              <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 32px' }}>
                {[0, 1, 2].map((i) => (
                  <motion.div key={i}
                    animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', inset: 0,
                      borderRadius: '50%',
                      border: '2px solid var(--color-warm-primary)',
                    }}
                  />
                ))}
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(255,107,53,0.15)',
                  border: '2px solid var(--color-warm-primary)',
                }} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                Reading your story&hellip;
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                We are carefully listening.
              </p>
            </motion.div>
          )}

          {state.step === 'GUIDE' && state.storyAnalysis && (
            <motion.div key="guide" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <GentleGuide
                questions={state.storyAnalysis.truth_metrics.follow_up_questions}
                answers={state.followUpAnswers}
                onChange={(a) => dispatch({ type: 'SET_FOLLOW_UP_ANSWERS', payload: a })}
                pullQuote={state.storyAnalysis.legal_tags.pull_quote}
                onContinue={() => dispatch({ type: 'NEXT_STEP' })}
                onSkip={() => dispatch({ type: 'NEXT_STEP' })}
              />
            </motion.div>
          )}

          {state.step === 'UPLOAD' && (
            <motion.div key="upload" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <LexShadeUpload
                stagingId={state.stagingId}
                onUpload={(id) => { dispatch({ type: 'SET_STAGING_ID', payload: id }); dispatch({ type: 'NEXT_STEP' }); }}
                onSkip={() => dispatch({ type: 'NEXT_STEP' })}
              />
            </motion.div>
          )}

          {state.step === 'CONFIRM' && state.storyAnalysis && (
            <motion.div key="confirm" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <ConfirmStep
                state={state}
                onEmailChange={(e) => dispatch({ type: 'SET_EMAIL', payload: e })}
                onSubmit={handleSubmit}
              />
            </motion.div>
          )}

          {state.step === 'SUCCESS' && (
            <motion.div key="success" variants={pageVariants} initial="initial" animate="animate" exit="exit"
              style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '24px' }}>🕯️</div>
              <h2 style={{
                fontFamily: 'var(--font-playfair-var, "Playfair Display", Georgia, serif)',
                fontSize: '1.8rem', fontWeight: 500,
                color: 'var(--color-text-primary)', marginBottom: '16px',
              }}>
                Their story has been recorded.
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px', lineHeight: 1.7 }}>
                It joins thousands of others — a single point of light, impossible to ignore.
              </p>
              {state.submittedStoryId && (
                <a href={`/story/${state.submittedStoryId}`} style={{
                  color: 'var(--color-warm-primary)', textDecoration: 'underline',
                  textUnderlineOffset: '3px', fontSize: '0.95rem',
                }}>
                  View their story →
                </a>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
