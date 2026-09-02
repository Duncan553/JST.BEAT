'use client';

import { useRef, useState } from 'react';
import { useCartStore } from '@/stores/useCartStore';
import type { PublicRelease } from '@/lib/store';

/**
 * Free streaming + the paid download button.
 *
 * The rule the store runs on: anyone can play the whole record for nothing,
 * but the file only comes after payment. So every track here plays from
 * `snippet_url` — a full-length 128kbps copy in the PUBLIC bucket. The master
 * lives in the private bucket and is only ever released as a signed URL by
 * /api/orders/download, and only once the order is marked paid by Paystack's
 * webhook. There is no free-download path anywhere in this component.
 */
export function ReleasePlayer({ release }: { release: PublicRelease }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { addItem, isInCart } = useCartStore();

  const play = (trackId: string, url: string | null) => {
    if (!url) return;
    const el = audioRef.current;
    if (!el) return;

    if (playingId === trackId) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = url;
    el.play().then(() => setPlayingId(trackId)).catch(() => setPlayingId(null));
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

  return (
    <div>
      {/* One shared audio element — playing a second track replaces the first
          rather than stacking overlapping players. */}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} preload="none" />

      <div className="border border-stone-800 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 bg-stone-900/60 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-300 uppercase tracking-wide">Tracks</h2>
          <span className="text-xs text-stone-500">Free to play</span>
        </div>
        <ol className="divide-y divide-stone-800">
          {release.tracks.map((t) => {
            const isPlaying = playingId === t.id;
            return (
              <li key={t.id} className="flex items-center gap-3 p-3 hover:bg-stone-900/40 transition-colors">
                <span className="w-6 text-center text-xs text-stone-600 tabular-nums">{t.track_number}</span>
                <button
                  onClick={() => play(t.id, t.snippet_url)}
                  disabled={!t.snippet_url}
                  aria-label={isPlaying ? `Pause ${t.title}` : `Play ${t.title}`}
                  className="w-9 h-9 shrink-0 rounded-full bg-orange-600 hover:bg-orange-500 disabled:bg-stone-700 flex items-center justify-center transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                >
                  {isPlaying ? (
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
        <button
          onClick={buy}
          disabled={alreadyIn}
          className="w-full bg-orange-600 text-white py-3 rounded-full font-bold hover:bg-orange-500 disabled:bg-stone-700 disabled:text-stone-400 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
        >
          {alreadyIn ? 'In your cart' : `Buy to download — KSh ${release.price}`}
        </button>
      </div>
    </div>
  );
}
