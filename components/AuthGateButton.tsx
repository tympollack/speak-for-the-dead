'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AuthGateButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    const supabase = createClient();
    
    // Check current Supabase Auth session state
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Valid session exists: Open SFTD Intake Form
      router.push('/submit');
    } else {
      // NO session exists: Redirect to SunShade Hub login route
      const rawHubUrl = process.env.NEXT_PUBLIC_SUNSHADE_HUB_URL || 'https://hub.sunshade.systems';
      const hubUrl = rawHubUrl.replace(/\/+$/, ''); // Strip trailing slash if present
      const callbackUrl = encodeURIComponent(`${window.location.origin}/submit`);
      window.location.href = `${hubUrl}/auth?redirectTo=${callbackUrl}`;
    }
    
    setIsLoading(false);
  };

  return (
    <button 
      onClick={handleClick}
      className="cta-btn"
      disabled={isLoading}
    >
      {isLoading ? 'Checking...' : 'Add Your Story'}
    </button>
  );
}
