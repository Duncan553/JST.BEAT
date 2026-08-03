import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Build-safe: never pass undefined to createClient
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'dummy-anon-key-for-build'
);