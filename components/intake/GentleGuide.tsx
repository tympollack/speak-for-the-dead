'use client';

import { motion, type Variants } from 'framer-motion';

interface GentleGuideProps {
  questions: string[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  pullQuote: string;
  onContinue: () => void;
  onSkip: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeInOut' } },
};

export default function GentleGuide({
  questions,
  answers,
  onChange,
  pullQuote,
  onContinue,
  onSkip,
}: GentleGuideProps) {
  const handleAnswerChange = (index: number, val: string) => {
    onChange({ ...answers, [`q${index}`]: val });
  };

  const isComplete = questions.length === 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
      }}
    >
      {/* Intro */}
      <motion.div variants={itemVariants}>
        {!isComplete ? (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '1rem',
              lineHeight: 1.7,
            }}
          >
            A few more details could help us document the systemic failure more precisely.
          </p>
        ) : (
          <p
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '1rem',
              lineHeight: 1.7,
            }}
          >
            Your story is complete.
          </p>
        )}
      </motion.div>

      {/* Pull quote card */}
      {pullQuote && (
        <motion.div
          variants={itemVariants}
          style={{
            background: 'rgba(19, 19, 26, 0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 32px',
            position: 'relative',
          }}
        >
          {/* Decorative quote mark */}
          <span
            aria-hidden="true"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '5rem',
              lineHeight: 1,
              color: 'rgba(255, 107, 53, 0.2)',
              position: 'absolute',
              top: '8px',
              left: '20px',
              fontWeight: 700,
              userSelect: 'none',
            }}
          >
            &ldquo;
          </span>
          <p
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(1rem, 2.5vw, 1.1875rem)',
              fontStyle: 'italic',
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              lineHeight: 1.7,
              position: 'relative',
              zIndex: 1,
              paddingLeft: '16px',
            }}
          >
            {pullQuote}
          </p>
        </motion.div>
      )}

      {/* Complete state */}
      {isComplete ? (
        <motion.div
          variants={itemVariants}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          {/* Checkmark */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1.5px solid rgba(34, 197, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 13L9 17L19 7"
                stroke="#22C55E"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
          <p
            style={{
              color: 'var(--color-text-primary)',
              fontSize: '1.0625rem',
              fontWeight: 500,
            }}
          >
            We have everything we need.
          </p>
        </motion.div>
      ) : (
        /* Questions */
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          {questions.map((question, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <label
                htmlFor={`guide-q-${index}`}
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                  fontWeight: 400,
                }}
              >
                {question}
              </label>
              <textarea
                id={`guide-q-${index}`}
                value={answers[`q${index}`] ?? ''}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
                placeholder="Take your time..."
                rows={3}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '0.9375rem',
                  lineHeight: 1.75,
                  padding: '14px 16px',
                  width: '100%',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(76,201,240,0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        variants={itemVariants}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <motion.button
          id="guide-continue"
          onClick={onContinue}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '13px 32px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'linear-gradient(135deg, var(--color-warm-primary) 0%, var(--color-warm-secondary) 100%)',
            color: '#fff',
            fontSize: '0.9375rem',
            fontWeight: 500,
            fontFamily: "'Inter', system-ui, sans-serif",
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,107,53,0.35)',
          }}
        >
          Continue
        </motion.button>

        <button
          id="guide-skip"
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-muted)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '4px 0',
            textDecoration: 'underline',
            textDecorationColor: 'rgba(255,255,255,0.12)',
            fontFamily: "'Inter', system-ui, sans-serif",
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-muted)')}
        >
          Skip this step
        </button>
      </motion.div>
    </motion.div>
  );
}
