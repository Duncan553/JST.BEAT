'use client';

import { useState, useEffect } from 'react';
import { Beat } from '@/types/beat';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useCartStore } from '@/stores/useCartStore';
import Link from 'next/link';
import Image from 'next/image';

interface BeatChipProps {
  beat: Beat;
}

export function BeatChip({ beat }: BeatChipProps) {
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();
  const { isInCart } = useCartStore();
  const isThisPlaying = currentBeatId === beat.id && isPlaying;
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    setInCart(isInCart(beat.id));
  }, [isInCart, beat.id]);

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url, beat.title, beat.cover_art);
  };

  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-full border border-stone-800 bg-stone-900/40 hover:bg-stone-800/60 hover:border-orange-500/30 transition-all duration-200 shrink-0 group">
      {/* The link wraps everything EXCEPT the play button */}
      <Link 
        href={`/beats/${beat.id}`}
        className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none rounded-full"
      >
        {/* Mini vinyl / cover */}
        <div 
          className="relative w-8 h-8 rounded-full overflow-hidden border border-stone-700 shrink-0"
          style={{ animation: isThisPlaying ? 'chip-spin 2s linear infinite' : 'none' }}
        >
          <Image
            src={beat.cover_art || '/images/hero-studio.jpg'}
            alt=""
            fill
            sizes="32px"
            className="object-cover"
          />
          {isThisPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30" aria-hidden="true">
              <span className="flex gap-[2px] items-end h-3">
                <span className="w-[2px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite] motion-reduce:animate-none" style={{ height: '40%', animationDelay: '0ms' }} />
                <span className="w-[2px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite] motion-reduce:animate-none" style={{ height: '90%', animationDelay: '120ms' }} />
                <span className="w-[2px] bg-orange-500 rounded-full animate-[bounce_0.8s_ease-in-out_infinite] motion-reduce:animate-none" style={{ height: '60%', animationDelay: '240ms' }} />
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-stone-200 group-hover:text-white truncate max-w-[140px] leading-none">
            {beat.title}
          </p>
          <p className="text-[10px] text-stone-500 mt-0.5">
            {beat.bpm} BPM · KSh {beat.price_wav}
          </p>
        </div>
      </Link>

      {/* Play button - SEPARATE from Link, stops propagation */}
      <button
        onClick={handlePlay}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-800 hover:bg-orange-600 text-stone-400 hover:text-white transition shrink-0 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none cursor-pointer"
        aria-label={isThisPlaying ? 'Pause' : 'Play'}
      >
        {isThisPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-px" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Cart indicator */}
      {inCart && (
        <span className="text-[10px] text-orange-500 font-bold shrink-0">🛒</span>
      )}
    </div>
  );
}
