'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/useCartStore';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { premiereState, formatCountdown, formatPremiereDate } from '@/lib/premiere';
import { TrackGateModal } from '@/components/store/TrackGateModal';
import type { PublicRelease } from '@/lib/store';

/**
 * Free streaming + the paid download button.
 *
 * The rule the store runs on: once a record is out, anyone can play the whole
 * thing for nothing (before a premiere, nobody can — see withPremiereGate),
 * but the file only comes after payment. So every track here plays from
 * `snippet_url` — a full-length 128kbps copy in the PUBLIC bucket. The master
 * lives in the private bucket and is only ever released as a signed URL by
 * /api/orders/download, and only once the order is marked paid by Paystack's
 * webhook. There is no free-download path anywhere in this component.
 *
 * Playback goes through the SITE-WIDE player (usePlayerStore), not a private
 * <audio> element. That element was a real bug: it knew nothing about the beat
 * player, so a beat and a record could play over each other, and a track
 * stopped dead the moment you left the page. Sharing the one player also means
 * store tracks get the seek bar and the volume control for free.
 */
export function ReleasePlayer({ release }: { release: PublicRelease }) {
  const [added, setAdded] = useState(false);
  const { addItem, isInCart } = useCartStore();
  const { currentBeatId, isPlaying: playerPlaying, play: playTrack, pause } = usePlayerStore();

  const play = (trackId: string, url: string | null, title: string) => {
    // Before a premiere the server withholds snippet_url entirely, so there is
    // nothing to play — explain that instead of a dead button.
    if (!url) {
      if (isEarly) setGateTrack({ title });
      return;
    }
    // Same track already going → pause. Anything else → hand it to the shared
    // player, which stops whatever was playing before by construction.
    if (currentBeatId === trackId && playerPlaying) {
      pause();
      return;
    }
    playTrack(trackId, url, title, release.cover_art, release.title);
  };

  const buy = () => {
    // A release is sold whole, so it enters the cart as one line. `license`
    // reuses the beats cart shape; the checkout treats it as a release via
    // the `kind` flag below.
    addItem(
      {
        id: release.id,
        title: release.title,
        cover_art: release.cover_art,
        price_wav: release.price,
        price_stems: 0,
        // The cart shows this; it must never be a private path.
        snippet_url: release.tracks[0]?.snippet_url || '',
        kind: 'release',
      } as any,
      'wav'
    );
    setAdded(true);
  };

  const alreadyIn = added || isInCart(release.id, 'wav');

  // Computed on every render rather than in state: this component already
  // re-renders whenever the player ticks, and a stale window here would tell a
  // buyer the wrong thing about what they are paying for.
  const premiere = premiereState(release.premiere_at);
  const isEarly = premiere.status === 'upcoming';

  // Which track's download was tapped. null = modal closed. Holding the track
  // rather than a boolean lets the dialog name what was clicked.
  const [gateTrack, setGateTrack] = useState<{ title: string } | null>(null);

  return (
    <div>
      <div className="border border-stone-800 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 bg-stone-900/60 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wide">Tracks</h2>
          <span className="text-xs text-stone-500">
            {isEarly ? 'Locked until the premiere' : 'Free to play'}
          </span>
        </div>
        <ol className="divide-y divide-stone-800">
          {release.tracks.map((t) => {
            const isPlaying = currentBeatId === t.id && playerPlaying;
            return (
              <li key={t.id} className="flex items-center gap-3 p-3 hover:bg-stone-900/40 transition-colors">
                <span className="w-6 text-center text-xs text-stone-600 tabular-nums">{t.track_number}</span>
                <button
                  onClick={() => play(t.id, t.snippet_url, t.title)}
                  // NOT disabled while locked — a disabled button gives no
                  // reason. It stays tappable so it can open the dialog and
                  // say when the record plays.
                  disabled={!t.snippet_url && !isEarly}
                  aria-label={
                    !t.snippet_url && isEarly
                      ? `${t.title} — locked until the premiere`
                      : isPlaying ? `Pause ${t.title}` : `Play ${t.title}`
                  }
                  className="w-9 h-9 shrink-0 rounded-full bg-orange-600 hover:bg-orange-500 disabled:bg-stone-700 flex items-center justify-center transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                  style={!t.snippet_url && isEarly ? { background: 'var(--surface-2)' } : undefined}
                >
                  {!t.snippet_url && isEarly ? (
                    <svg className="w-4 h-4" style={{ color: 'var(--text-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
                    </svg>
                  ) : isPlaying ? (
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 min-w-0 truncate ${isPlaying ? 'text-orange-300' : 'text-stone-200'}`}>
                  {t.title}
                </span>

                {/* Per-track download. It never downloads from here — the master
                    is only ever handed out by /api/orders/download after a paid
                    order. Tapping it explains WHY, which is the question someone
                    actually has at this moment. */}
                <button
                  onClick={() => setGateTrack({ title: t.title })}
                  aria-label={`Download ${t.title}`}
                  className="w-9 h-9 shrink-0 grid place-items-center rounded-full transition-colors duration-[var(--dur-1)] hover:bg-stone-800 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none cursor-pointer"
                  style={{ color: 'var(--text-3)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="border border-stone-800 rounded-xl bg-stone-900/40 p-5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-stone-400">
            Download {release.kind === 'album' ? 'the whole album' : 'the single'}
          </span>
          <span className="text-2xl font-bold text-orange-100 tabular-nums">KSh {release.price}</span>
        </div>
        <p className="text-xs text-stone-600 mb-4">
          Full-quality files, {release.tracks.length} track{release.tracks.length === 1 ? '' : 's'}.
          Streaming above is a 128kbps preview — the download is the original.
        </p>

        {/* Before a premiere, buying is EARLY ACCESS — the file arrives now,
            not on the date. Say that plainly: a countdown next to a buy button
            otherwise reads as "you will have to wait", which is the opposite of
            what paying does here. */}
        {isEarly && premiere.status === 'upcoming' && (
          <div
            className="mb-4 p-3 rounded-lg border text-xs leading-relaxed"
            style={{ borderColor: 'var(--line)', background: 'var(--accent-soft)', color: 'var(--text-2)' }}
          >
            <strong style={{ color: 'var(--accent-hot)' }}>
              Premieres in {formatCountdown(premiere.msRemaining)}
            </strong>{' '}
            ({formatPremiereDate(premiere.at)}). Nobody can play it until then — the
            tracks unlock for everyone, free, on the date. Buying now gets you the
            files <strong>today</strong>, before anyone else has heard it.
          </div>
        )}
        <button
          onClick={buy}
          disabled={alreadyIn}
          className="w-full bg-orange-600 text-white py-3 rounded-full font-bold hover:bg-orange-500 disabled:bg-stone-700 disabled:text-stone-400 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
        >
          {alreadyIn ? 'In your cart' : `Buy to download — KSh ${release.price}`}
        </button>
      </div>

      <TrackGateModal
        open={gateTrack !== null}
        onClose={() => setGateTrack(null)}
        onBuy={() => { buy(); setGateTrack(null); }}
        trackTitle={gateTrack?.title || ''}
        releaseTitle={release.title}
        price={release.price}
        premiereAt={release.premiere_at}
        alreadyInCart={alreadyIn}
      />
    </div>
  );
}
