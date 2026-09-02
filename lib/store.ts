import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Server-side reads for the public store.
 *
 * These go through the service-role client and hand-pick columns because
 * `tracks` has NO anon read policy on purpose: RLS is row-level, so if the
 * browser could read that table at all it could ask for `full_url` and walk
 * off with the path to the master. Everything public flows through here
 * instead, and `full_url` never leaves the server.
 */

export type PublicTrack = {
  id: string;
  title: string;
  track_number: number;
  /** 128kbps full-length stream. Free to play. Never the master. */
  snippet_url: string | null;
  duration_seconds: number | null;
};

export type PublicRelease = {
  id: string;
  producer: string;
  artist: string | null;
  kind: 'single' | 'album';
  title: string;
  description: string | null;
  cover_art: string;
  price: number;
  created_at: string;
  tracks: PublicTrack[];
};

// Every column here is safe to publish. full_url is deliberately absent.
const SAFE_TRACK_COLUMNS = 'id, title, track_number, snippet_url, duration_seconds';
const SAFE_RELEASE_COLUMNS =
  'id, producer, artist, kind, title, description, cover_art, price, created_at';

export async function getPublishedReleases(): Promise<PublicRelease[]> {
  const { data, error } = await supabaseAdmin
    .from('releases')
    .select(`${SAFE_RELEASE_COLUMNS}, tracks(${SAFE_TRACK_COLUMNS})`)
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Store] release list error:', error.message);
    return [];
  }
  return (data || []).map(sortTracks) as PublicRelease[];
}

export async function getPublishedRelease(id: string): Promise<PublicRelease | null> {
  // A malformed id would make Postgres throw on the uuid cast; bail early so
  // a junk URL is a clean 404 rather than a 500.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data, error } = await supabaseAdmin
    .from('releases')
    .select(`${SAFE_RELEASE_COLUMNS}, tracks(${SAFE_TRACK_COLUMNS})`)
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    console.error('[Store] release fetch error:', error.message);
    return null;
  }
  return data ? (sortTracks(data) as PublicRelease) : null;
}

/** Postgres gives related rows back unordered; a tracklist must be in order. */
function sortTracks<T extends { tracks?: PublicTrack[] }>(release: T): T {
  return {
    ...release,
    tracks: [...(release.tracks || [])].sort((a, b) => a.track_number - b.track_number),
  };
}
