import { supabaseAdmin } from '@/lib/supabase-admin';
import { premiereState } from '@/lib/premiere';

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
  /** Optional dated premiere. NULL/absent = an ordinary release. */
  premiere_at: string | null;
  /** Parental advisory. The artist's call, never inferred from the audio. */
  explicit: boolean;
  tracks: PublicTrack[];
};

// Every column here is safe to publish. full_url is deliberately absent.
const SAFE_TRACK_COLUMNS = 'id, title, track_number, snippet_url, duration_seconds';
const SAFE_RELEASE_COLUMNS =
  'id, producer, artist, kind, title, description, cover_art, price, created_at, premiere_at, explicit';

// The same list without premiere_at, for the window between deploying this code
// and running migrations/2026-09-07-premiere.sql. Postgres answers 42703
// (undefined_column) for a column that isn't there yet; the store falls back
// rather than going blank. Same pattern as the producer-column fallback in
// stores/useBeatsStore.ts.
const SAFE_RELEASE_COLUMNS_NO_PREMIERE =
  'id, producer, artist, kind, title, description, cover_art, price, created_at';

/** True when Postgres is telling us the premiere column hasn't been added yet. */
function isMissingPremiereColumn(err: { code?: string; message?: string } | null): boolean {
  return err?.code === '42703' && /premiere_at|explicit/.test(err?.message || '');
}

export async function getPublishedReleases(): Promise<PublicRelease[]> {
  let { data, error } = await supabaseAdmin
    .from('releases')
    .select(`${SAFE_RELEASE_COLUMNS}, tracks(${SAFE_TRACK_COLUMNS})`)
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (isMissingPremiereColumn(error)) {
    const fallback = await supabaseAdmin
      .from('releases')
      .select(`${SAFE_RELEASE_COLUMNS_NO_PREMIERE}, tracks(${SAFE_TRACK_COLUMNS})`)
      .eq('published', true)
      .order('created_at', { ascending: false });
    data = (fallback.data || []).map((r) => ({ ...r, premiere_at: null, explicit: false })) as typeof data;
    error = fallback.error;
  }

  if (error) {
    console.error('[Store] release list error:', error.message);
    return [];
  }
  return (data || []).map(sortTracks).map(withPremiereGate) as PublicRelease[];
}

export async function getPublishedRelease(id: string): Promise<PublicRelease | null> {
  // A malformed id would make Postgres throw on the uuid cast; bail early so
  // a junk URL is a clean 404 rather than a 500.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  let { data, error } = await supabaseAdmin
    .from('releases')
    .select(`${SAFE_RELEASE_COLUMNS}, tracks(${SAFE_TRACK_COLUMNS})`)
    .eq('id', id)
    .eq('published', true)
    .maybeSingle();

  if (isMissingPremiereColumn(error)) {
    const fallback = await supabaseAdmin
      .from('releases')
      .select(`${SAFE_RELEASE_COLUMNS_NO_PREMIERE}, tracks(${SAFE_TRACK_COLUMNS})`)
      .eq('id', id)
      .eq('published', true)
      .maybeSingle();
    data = (fallback.data ? { ...fallback.data, premiere_at: null, explicit: false } : null) as typeof data;
    error = fallback.error;
  }

  if (error) {
    console.error('[Store] release fetch error:', error.message);
    return null;
  }
  return data ? (withPremiereGate(sortTracks(data)) as PublicRelease) : null;
}

/** Postgres gives related rows back unordered; a tracklist must be in order. */
/**
 * THE PREMIERE GATE.
 *
 * Before a release premieres, nobody can play it — so the stream URL must not
 * leave the server at all. Hiding the play button while still shipping
 * `snippet_url` in the payload would be a UI-only lock: anyone could read the
 * URL out of the network tab and play the record early. The check therefore
 * lives HERE, in the server-side read, not in a component.
 *
 * Buying is unaffected: a paid order still gets the master from
 * /api/orders/download, which is exactly what makes buying before a premiere
 * worth something — you get the record while nobody else can even hear it.
 *
 * KNOWN RESIDUAL GAP, stated rather than papered over: these stream objects
 * live in the PUBLIC `beats-public` bucket, so a file is still readable by
 * anyone who already knows its path. Withholding the URL removes the only
 * realistic way to find it. Closing the gap completely means putting
 * pre-premiere streams in the private bucket behind signed URLs — docs/TODO.md §7b.
 */
function withPremiereGate<T extends { premiere_at?: string | null; tracks?: PublicTrack[] }>(release: T): T {
  if (premiereState(release.premiere_at ?? null).status !== 'upcoming') return release;
  return {
    ...release,
    tracks: (release.tracks || []).map((t) => ({ ...t, snippet_url: null })),
  };
}

function sortTracks<T extends { tracks?: PublicTrack[] }>(release: T): T {
  return {
    ...release,
    tracks: [...(release.tracks || [])].sort((a, b) => a.track_number - b.track_number),
  };
}
