'use client';

import { useState, useEffect } from 'react';
import { Beat } from '@/types/beat';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useUsdToKes } from '@/hooks/useUsdToKes';
import Link from 'next/link';
import Image from 'next/image';
import { formatUsd, formatKes } from '@/lib/currency';

/**
 * The showcase card: cover art at full size, for the landing page.
 *
 * BeatChip stays the right thing for /beats, where the job is scanning fifty
 * titles in one screen. Here the job is the opposite — there are four of them
 * and the cover art IS the product, so it gets the space. Card rules come from
 * .claude/skills/design/SKILL.md: --surface-1, 1px --line, rounded-2xl, lift
 * to --surface-2 on hover, square cover, never distorted.
 */
export function BeatCard({ beat }: { beat: Beat }) {
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();
  const { kes } = useUsdToKes();
  const isThisPlaying = currentBeatId === beat.id && isPlaying;

  // Mounted flag: the KSh line depends on a rate fetched in the browser, so
  // rendering it on the server would mismatch on hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url, beat.title, beat.cover_art);
  };

  const kesPrice = mounted ? kes(beat.price_usd_wav) : null;

  return (
    <Link
      href={`/beats/${beat.id}`}
      className="group block rounded-2xl overflow-hidden border transition-colors duration-[var(--dur-1)] motion-lift focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--line)' }}
    >
      {/* Cover — always square so a grid of these never goes ragged, whatever
          aspect ratio the producer uploaded. */}
      <div className="relative aspect-square overflow-hidden" style={{ background: 'var(--surface-2)' }}>
        <Image
          src={beat.cover_art || '/images/hero-studio.jpg'}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />

        {/* Play sits on the art. It is a real <button> inside the card link, so
            the click must be stopped from also navigating — see handlePlay. */}
        <button
          onClick={handlePlay}
          aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play ${beat.title}`}
          className="absolute bottom-3 right-3 w-11 h-11 grid place-items-center rounded-full bg-orange-600 text-white shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 translate-y-1 group-hover:translate-y-0 transition duration-[var(--dur-2)] ease-[var(--ease-out)] motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none cursor-pointer data-[playing=true]:opacity-100 data-[playing=true]:translate-y-0"
          data-playing={isThisPlaying}
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
      </div>

      <div className="p-4">
        <h3 className="font-display font-bold text-[0.9375rem] truncate" style={{ color: 'var(--text-1)' }}>
          {beat.title}
        </h3>
        {/* Meta stays quiet: --text-3 is the caption tier. */}
        <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
          {beat.producer} · {beat.bpm} BPM{beat.key ? ` · ${beat.key}` : ''}
        </p>

        {/* Price in the display face — it is the number people scan for. USD is
            the price; the KSh underneath is derived from the live rate, and is
            simply absent until that rate lands rather than flashing a guess. */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
            {formatUsd(beat.price_usd_wav)}
          </span>
          {kesPrice && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
              ≈ {formatKes(kesPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
