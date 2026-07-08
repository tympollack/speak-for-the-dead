'use client';

interface ShareButtonProps {
  storyId: string;
}

export default function ShareButton({ storyId }: ShareButtonProps) {
  const handleShare = async () => {
    const url = `${window.location.origin}/story/${storyId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'A story from Speak for the Dead', url });
      } else {
        await navigator.clipboard.writeText(url);
        // Simple feedback — no toast library dependency
        const btn = document.getElementById('share-btn');
        if (btn) { btn.textContent = 'Link copied!'; setTimeout(() => { btn.textContent = 'Share this story'; }, 2000); }
      }
    } catch { /* user cancelled share */ }
  };

  return (
    <button
      id="share-btn"
      onClick={handleShare}
      style={{
        padding: '10px 20px',
        borderRadius: '99px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '0.875rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.4)'; (e.currentTarget).style.color = '#fff'; }}
      onMouseLeave={(e) => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget).style.color = 'rgba(255,255,255,0.7)'; }}
    >
      Share this story
    </button>
  );
}
