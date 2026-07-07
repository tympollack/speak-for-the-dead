'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LexShadeUploadProps {
  onUpload: (stagingId: string) => void;
  onSkip: () => void;
  stagingId: string | null;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function LexShadeUpload({ onUpload, onSkip, stagingId }: LexShadeUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, WebP, or PDF file.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('File must be 10 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      // Step 1: Get signed upload URL from server
      const tokenRes = await fetch('/api/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to prepare upload.');
      }

      const { signedUrl, stagingId: newStagingId } = await tokenRes.json();

      // Step 2: Upload directly to Supabase Storage via signed URL
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error('Upload failed. Please try again.');

      onUpload(newStagingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ width: '100%', maxWidth: '560px', margin: '0 auto' }}
    >
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '10px' }}>
        Support Your Story
        <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 400, verticalAlign: 'middle' }}>
          Optional
        </span>
      </h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', lineHeight: 1.65, marginBottom: '28px' }}>
        An obituary, OSHA report, or news article can earn your story an{' '}
        <span style={{ color: 'var(--color-cool-primary)', fontWeight: 500 }}>Anchor Story</span>{' '}
        badge — validating the unverified many.
      </p>

      <AnimatePresence mode="wait">
        {stagingId ? (
          // ── Success state ──────────────────────────────────────────────────
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass"
            style={{ padding: '32px', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}
          >
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" style={{ margin: '0 auto 16px', display: 'block' }}>
              <circle cx="26" cy="26" r="25" fill="rgba(76,201,240,0.1)" stroke="var(--color-cool-primary)" strokeWidth="1.5" />
              <path d="M16 26l7 7 13-14" stroke="var(--color-cool-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '1rem', marginBottom: '8px' }}>
              Document uploaded.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>
              Your story will be reviewed for Anchor Story status.
            </p>
            <span style={{
              display: 'inline-block',
              padding: '5px 14px',
              borderRadius: '99px',
              border: '1px solid var(--color-cool-primary)',
              color: 'var(--color-cool-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              letterSpacing: '0.04em',
            }}>
              ⚓ Verification Pending
            </span>
          </motion.div>
        ) : (
          // ── Upload zone ────────────────────────────────────────────────────
          <motion.div key="upload">
            <label
              htmlFor="lexshade-file"
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                padding: '48px 32px',
                borderRadius: 'var(--radius-lg)',
                border: `2px dashed ${isDragOver ? 'var(--color-cool-primary)' : 'var(--color-border)'}`,
                background: isDragOver ? 'rgba(76,201,240,0.05)' : 'rgba(255,255,255,0.02)',
                cursor: isUploading ? 'wait' : 'pointer',
                transition: 'border-color 0.2s ease, background 0.2s ease',
                boxShadow: isDragOver ? '0 0 24px rgba(76,201,240,0.12)' : 'none',
              }}
            >
              <input
                id="lexshade-file"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                style={{ display: 'none' }}
                onChange={handleInputChange}
                disabled={isUploading}
              />
              {/* Upload icon */}
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M20 28V16M20 16l-5 5M20 16l5 5" stroke={isDragOver ? 'var(--color-cool-primary)' : 'var(--color-text-muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 28v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke={isDragOver ? 'var(--color-cool-primary)' : 'var(--color-text-muted)'} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: isUploading ? 'var(--color-text-muted)' : 'var(--color-text-primary)', fontWeight: 500, margin: '0 0 6px' }}>
                  {isUploading ? 'Uploading...' : 'Drop a file here, or click to browse'}
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: 0 }}>
                  JPG, PNG, WebP, PDF · Max 10 MB
                </p>
              </div>
            </label>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: 'var(--color-warm-secondary)', fontSize: '0.875rem', marginTop: '12px', textAlign: 'center' }}
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none',
            color: 'var(--color-text-muted)', fontSize: '0.875rem',
            cursor: 'pointer', textDecoration: 'underline',
            textUnderlineOffset: '3px', padding: '4px',
          }}
        >
          Submit without document
        </button>
      </div>
    </motion.div>
  );
}
