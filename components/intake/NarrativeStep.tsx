'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

type StoryType = 'IN_MEMORIAM' | 'NEAR_MISS';

interface NarrativeStepProps {
  storyType: StoryType;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
  isAnalyzing: boolean;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function NarrativeStep({
  storyType,
  value,
  onChange,
  onContinue,
  isAnalyzing,
}: NarrativeStepProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wordCount = countWords(value);
  const canContinue = wordCount >= 30 && !isAnalyzing;

  const isWarm = storyType === 'IN_MEMORIAM';
  const accentColor = isWarm ? 'var(--color-warm-primary)' : 'var(--color-cool-primary)';

  const heading = isWarm ? 'Tell us about them.' : 'Tell us what happened.';
  const subheading = isWarm
    ? 'Share their story in your own words. There is no wrong way to begin.'
    : 'Share what occurred, and how a regulation may have made the difference.';

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(200, el.scrollHeight)}px`;
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  // Word count color
  const getWordCountColor = () => {
    if (wordCount === 0) return 'var(--color-text-muted)';
    if (wordCount < 30) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
      }}
    >
      {/* Heading */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
          }}
        >
          {heading}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '1rem',
            lineHeight: 1.6,
          }}
        >
          {subheading}
        </motion.p>
      </div>

      {/* Textarea */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        style={{ position: 'relative' }}
      >
        <textarea
          id="narrative-textarea"
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder="Start wherever feels right..."
          disabled={isAnalyzing}
          rows={8}
          aria-label="Your story"
          style={{
            width: '100%',
            minHeight: '200px',
            background: 'var(--color-bg-card)',
            border: `1.5px solid ${value.length > 0 ? 'rgba(255,255,255,0.12)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-primary)',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '1.0625rem',
            lineHeight: 1.85,
            padding: '20px 24px',
            resize: 'none',
            outline: 'none',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            boxShadow: value.length > 0 ? `0 0 0 3px ${isWarm ? 'rgba(255,107,53,0.07)' : 'rgba(76,201,240,0.07)'}` : 'none',
            opacity: isAnalyzing ? 0.6 : 1,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = accentColor;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${isWarm ? 'rgba(255,107,53,0.12)' : 'rgba(76,201,240,0.12)'}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor =
              value.length > 0 ? 'rgba(255,255,255,0.12)' : 'var(--color-border)';
            e.currentTarget.style.boxShadow =
              value.length > 0
                ? `0 0 0 3px ${isWarm ? 'rgba(255,107,53,0.07)' : 'rgba(76,201,240,0.07)'}`
                : 'none';
          }}
        />

        {/* Word count */}
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '2px',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: getWordCountColor(),
              transition: 'color var(--transition-fast)',
            }}
          >
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          {wordCount > 0 && wordCount < 30 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
              {30 - wordCount} more to continue
            </span>
          )}
          {wordCount >= 30 && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
              The more detail, the stronger the case.
            </span>
          )}
        </div>
      </motion.div>

      {/* Continue button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <motion.button
          id="narrative-continue"
          onClick={onContinue}
          disabled={!canContinue}
          whileHover={canContinue ? { scale: 1.02, y: -1 } : {}}
          whileTap={canContinue ? { scale: 0.98 } : {}}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '14px 36px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: canContinue
              ? `linear-gradient(135deg, ${isWarm ? 'var(--color-warm-primary)' : 'var(--color-cool-primary)'} 0%, ${isWarm ? 'var(--color-warm-secondary)' : 'var(--color-cool-secondary)'} 100%)`
              : 'var(--color-bg-elevated)',
            color: canContinue ? '#fff' : 'var(--color-text-muted)',
            fontSize: '0.9375rem',
            fontWeight: 500,
            fontFamily: "'Inter', system-ui, sans-serif",
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue
              ? isWarm
                ? '0 4px 24px rgba(255,107,53,0.4)'
                : '0 4px 24px rgba(76,201,240,0.3)'
              : 'none',
            transition: 'all var(--transition-fast)',
            opacity: !canContinue && !isAnalyzing ? 0.45 : 1,
          }}
          aria-busy={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
                style={{ fontSize: '0.875rem' }}
              >
                ●
              </motion.span>
              Reading your story...
            </>
          ) : (
            'Continue'
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
