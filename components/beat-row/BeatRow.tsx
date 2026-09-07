'use client';

import { useState, useEffect } from 'react';
import { Beat } from '@/types/beat';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useCartStore } from '@/stores/useCartStore';
import { useUsdToKes } from '@/hooks/useUsdToKes';
import Link from 'next/link';
import Image from 'next/image';
import { formatUsd, formatKes } from '@/lib/currency';

/**
 * One beat as a LIST ROW — the catalogue format.
 *
 * Why a row and not a card, once there are more than a handful:
 *
 * 1. Buying a beat is a COMPARISON, and comparison needs alignment. BPM, key
 *    and price sit in fixed columns here, so your eye runs straight down one
 *    number instead of hunting for it inside twenty separate boxes. In a card
 *    grid every value lands in a different place on the screen.
 * 2. Bandwidth. The artwork is a 56px thumbnail, not a 300px cover, so a
 *    hundred-beat page pulls a fraction of the bytes. That is the real cost of
 *    a big grid on a phone on mobile data, and it is why every beat
 *    marketplace that got large converged on rows.
 *
 * The landing page still uses BeatCard: four covers whose job is to be looked
 * at, not compared. Different task, different component.
 */
export function BeatRow({ beat }: { beat: Beat }) {
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();
  const { isInCart } = useCartStore();
  const { kes } = useUsdToKes();
  const isThisPlaying = currentBeatId === beat.id && isPlaying;

  // Cart membership and the KSh rate are both browser-only facts. Reading them
  // during the server render would produce HTML that disagrees with the first
  // client paint, so both wait for mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const inCart = mounted && isInCart(beat.id);
  const kesPrice = mounted ? kes(beat.price_usd_wav) : null;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url, beat.title, beat.cover_art);
  };

  return (
    <div
      className="beat-row group rounded-xl border px-3 py-2.5 transition-colors duration-[var(--dur-1)]"
      style={{ borderColor: 'var(--line)', background: 'var(--surface-1)' }}
    >
      {/* Play — a real button, and the first thing in the row because it is the
          first thing anyone does. 44px is the minimum comfortable tap target. */}
      <button
        onClick={handlePlay}
        aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play ${beat.title}`}
        className="w-11 h-11 grid place-items-center rounded-full transition-colors duration-[var(--dur-1)] motion-press focus-visible:ring-2 focus-visible:ring-orange-500 outline-none cursor-pointer shrink-0"
        style={{
          background: isThisPlaying ? 'var(--accent)' : 'var(--surface-2)',
          color: isThisPlaying ? '#fff' : 'var(--text-2)',
        }}
      >
        {isThisPlaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Artwork at thumbnail size. `sizes` is what actually saves the bytes —
          without it Next serves a full-width candidate for a 56px box. */}
      <Link
        href={`/beats/${beat.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative w-12 h-12 md:w-14 md:h-14 rounded-lg overflow-hidden shrink-0"
        style={{ background: 'var(--surface-2)' }}
      >
        <Image
          src={beat.cover_art || '/images/hero-studio.jpg'}
          alt=""
          fill
          sizes="56px"
          className="object-cover"
        />
      </Link>

      {/* Title block. min-w-0 is what allows the truncate to actually fire —
          a grid item defaults to min-width:auto and refuses to shrink. */}
      <Link
        href={`/beats/${beat.id}`}
        className="min-w-0 focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
      >
        <p className="font-display font-bold text-[0.9375rem] truncate" style={{ color: 'var(--text-1)' }}>
          {beat.title}
          {inCart && (
            <span className="ml-2 text-[10px] font-sans font-bold align-middle" style={{ color: 'var(--accent-hot)' }}>
              IN CART
            </span>
          )}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
          {beat.producer}
          {/* On a phone there are no BPM/key columns, so fold them in here
              rather than dropping the information entirely. */}
          <span className="md:hidden">
            {' · '}{beat.bpm} BPM{beat.key ? ` · ${beat.key}` : ''}
          </span>
        </p>
      </Link>

      {/* Tags — desktop only, and capped at three. A row that wraps to two
          lines because a beat has nine tags breaks the scan rhythm of the
          whole list, which is the one thing this layout exists to protect. */}
      <div
        className="hidden md:flex gap-1.5 overflow-hidden"
        style={{
          // A tag chopped mid-word by overflow:hidden looks like a rendering
          // fault. Fading the last few pixels instead makes the cut read as
          // "there is more", which is what it means.
          maskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
          WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 24px), transparent)',
        }}
      >
        {(beat.tags || []).slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap"
            style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Aligned columns — desktop only. This is the whole point of the row. */}
      <p className="hidden md:block text-sm tabular-nums" style={{ color: 'var(--text-2)' }}>
        {beat.bpm} BPM
      </p>
      <p className="hidden md:block text-sm truncate" style={{ color: 'var(--text-3)' }}>
        {beat.key || beat.genre || '—'}
      </p>

      {/* Price last, right-aligned, in the display face — it is what people
          scan for, and a ragged price column is unreadable. */}
      <div className="text-right">
        <p className="font-display font-bold tabular-nums leading-none" style={{ color: 'var(--text-1)' }}>
          {formatUsd(beat.price_usd_wav)}
        </p>
        {kesPrice && (
          <p className="text-[11px] tabular-nums mt-1" style={{ color: 'var(--text-3)' }}>
            ≈ {formatKes(kesPrice)}
          </p>
        )}
      </div>
    </div>
  );
}
