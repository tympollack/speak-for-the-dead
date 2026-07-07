/**
 * server.ts
 *
 * Server-side Supabase client factory using @supabase/ssr.
 *
 * Usage (Server Component, Route Handler, Server Action):
 *   import { createClient } from '@/lib/supabase/server';
 *   const supabase = await createClient();
 *
 * This client uses the public anon key and reads the user's session from
 * HTTP cookies, making it appropriate for any server-side code that runs in
 * the context of an authenticated user request.
 *
 * For privileged server operations (bypassing RLS), use the admin client
 * defined inline in the relevant route handler with the service role key.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Returns an async server-side Supabase client that reads/writes the auth
 * session via Next.js cookie store.
 *
 * `setAll` is wrapped in a try/catch because cookies cannot be mutated inside
 * Server Components (only Route Handlers and Server Actions).  The silent
 * catch prevents crashes while still allowing session refreshes in mutable
 * contexts.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'speak_for_the_dead' },
      cookies: {
        /** Return all cookies for Supabase to locate the session token. */
        getAll() {
          return cookieStore.getAll();
        },
        /**
         * Persist refreshed tokens back to the response.  Silently ignored
         * inside Server Components where mutation is not permitted.
         */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Intentionally suppressed: Server Components cannot set cookies.
          }
        },
      },
    },
  );
}
