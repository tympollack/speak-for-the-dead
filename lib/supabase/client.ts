/**
 * client.ts
 *
 * Browser-side Supabase client factory using @supabase/ssr.
 *
 * Usage (React component or client-side hook):
 *   import { createClient } from '@/lib/supabase/client';
 *   const supabase = createClient();
 *
 * This client uses the public anon key only — it is safe to include in
 * browser bundles.  Row-Level Security policies on the database enforce
 * access control.  Never use the service role key here.
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Returns a Supabase browser client configured with the public project URL
 * and anon key.  Call this inside components or hooks — not at module scope —
 * so that the instance is created after environment variables are available.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'speak_for_the_dead' }
    }
  );
}
