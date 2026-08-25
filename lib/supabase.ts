import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Same reasoning as lib/supabase-admin.ts: don't throw at module import time,
// only when something actually calls the client. Next.js imports this module
// while collecting page data at build time (via the root layout), so an
// eager throw here broke builds in any environment missing these vars —
// even for pages that never touch Supabase.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  client = createClient(supabaseUrl, supabaseKey);
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
