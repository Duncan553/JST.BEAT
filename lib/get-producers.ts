import { supabaseAdmin } from '@/lib/supabase-admin';

export interface ProducerInfo {
  name: string;
  email: string;
  full_name: string | null;
  photo_url: string | null;
  whatsapp: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  youtube: string | null;
}

// Fallback used until migrations/2026-08-25-producers-table.sql has been
// applied (or a producer hasn't filled in their profile yet) — same shape
// as a row from the `producers` table.
const FALLBACK_PRODUCERS: ProducerInfo[] = [
  { name: 'jst.dan', email: 'dwachira2002@gmail.com', full_name: null, photo_url: null, whatsapp: '0114256994', instagram: 'j.s.tdan', tiktok: null, twitter: null, youtube: null },
  { name: 'tisco prodz', email: 'tscoprodz@gmail.com', full_name: null, photo_url: null, whatsapp: '0711405010', instagram: 'tiscoprodz', tiktok: null, twitter: null, youtube: null },
];

/** Server-only — used by pages that show producer bios/contact (About, Contact). */
export async function getProducers(): Promise<ProducerInfo[]> {
  const { data, error } = await supabaseAdmin
    .from('producers')
    .select('email, name, full_name, photo_url, whatsapp, instagram, tiktok, twitter, youtube');

  if (error || !data || data.length === 0) return FALLBACK_PRODUCERS;

  // Fill in anyone who hasn't set up a `producers` row yet so both names
  // always show, even before they've touched the Profile tab.
  const byName = new Map(data.map((p) => [p.name, p]));
  return FALLBACK_PRODUCERS.map((f) => byName.get(f.name) || f);
}
