import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Builds the real client on first use, not on import. Next.js imports every
// API route module during build (to collect page data) even for routes that
// only ever run with real env vars at request time — so throwing here at
// module load broke builds in any environment (Preview, Development) that
// doesn't have these secrets set, even though nothing was actually calling
// Supabase yet. Deferring the check to first real access keeps the build
// green everywhere and still fails loudly the moment a request needs it.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return client;
}

// Proxy forwards every property access (supabaseAdmin.auth, .storage, .from, ...)
// to the lazily-built real client, so no call site needs to change.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
