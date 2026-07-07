'use client';

/**
 * GlobeLoader — shown while the TruthEngineGlobe (WebGL) bundle is loading.
 * Must be a separate 'use client' file so it can be passed as the `loading`
 * prop to next/dynamic without Turbopack tripping over JSX in a server module.
 */
export default function GlobeLoader() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0A0A0F',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          border: '2px solid rgba(255,107,53,0.2)',
          borderTopColor: '#FF6B35',
          animation: 'globe-spin 1s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', letterSpacing: '0.1em', margin: 0 }}>
          LOADING TRUTH ENGINE
        </p>
      </div>
      <style>{`@keyframes globe-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
