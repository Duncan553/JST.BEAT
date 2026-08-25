import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Public — About page reads this to show photo/socials. Nothing here is
// private; RLS on the table also allows anon select for the same reason.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('producers')
    .select('email, name, full_name, photo_url, whatsapp, instagram, tiktok, twitter, youtube');

  // Table may not exist yet (migrations/2026-08-25-producers-table.sql not
  // run) — don't break the About page over it, just report empty.
  if (error) {
    return NextResponse.json({ success: true, producers: [] });
  }

  return NextResponse.json({ success: true, producers: data || [] });
}
