import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing env vars — using fallback (beats will not load)');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'fallback-key'
);// env rebuild
