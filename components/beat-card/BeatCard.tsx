'use client';

import { useState, useEffect } from 'react';
import { Beat } from '@/types/beat';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useCartStore } from '@/stores/useCartStore';
import Link from 'next/link';

interface BeatCardProps {
  beat: Beat;
}

export function BeatCard({ beat }: BeatCardProps) {
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();
  const { addItem, isInCart } = useCartStore();
  const isThisPlaying = currentBeatId === beat.id && isPlaying;

  const [alreadyInCart, setAlreadyInCart] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<'wav' | 'stems'>('wav');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setAlreadyInCart(isInCart(beat.id));
  }, [isInCart, beat.id]);

  const handlePlay = () => {
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url, beat.title, beat.cover_art);
  };

  const handleAddToCart = () => {
    if (alreadyInCart) return;
    addItem(beat, selectedLicense);
    setAlreadyInCart(true);
  };

  const hasStems = beat.price_stems > 0 && !!beat.stems_url;

  return (
    <article className="border border-stone-800 rounded-xl overflow-hidden hover:shadow-lg hover:shadow-orange-900/10 transition bg-stone-900/60 group hover:bg-stone-900/80">
      <Link href={`/beats/${beat.id}`} className="block focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none rounded-lg">
        <div
          className="aspect-square bg-stone-800 flex items-center justify-center text-white border-b border-stone-800"
          style={
            !imgError && beat.cover_art
              ? {
                  backgroundImage: `url(${beat.cover_art})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : undefined
          }
        >
          {(!beat.cover_art || imgError) && (
            <span className="text-lg font-bold truncate px-4 max-w-full">{beat.title}</span>
          )}
          {beat.cover_art && !imgError && (
            <img
              src={beat.cover_art}
              alt=""
              className="sr-only"
              onError={() => setImgError(true)}
            />
          )}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2 gap-2">
          <Link 
            href={`/beats/${beat.id}`}
            className="block focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
          >
            <h3 className="font-bold text-lg hover:underline line-clamp-1 text-orange-50" title={beat.title}>
              {beat.title}
            </h3>
          </Link>
          <span className="text-sm text-stone-400 tabular-nums shrink-0">{beat.bpm} BPM</span>
        </div>
        <div className="flex gap-2 text-sm text-stone-400 mb-4">
          <span>{beat.genre}</span>
          <span aria-hidden="true">·</span>
          <span>{beat.key}</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-4">
          {beat.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-1 bg-stone-800 text-stone-300 rounded truncate max-w-[120px]" title={tag}>
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={handlePlay}
          aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play preview of ${beat.title}`}
          className="w-full py-2 bg-orange-600 text-white rounded-lg mb-3 hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 outline-none touch-manipulation"
        >
          {isThisPlaying ? '⏸ Pause' : '▶ Play Snippet'}
        </button>

        {!alreadyInCart && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSelectedLicense('wav')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg border transition ${
                selectedLicense === 'wav'
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'border-stone-700 text-stone-400 hover:border-orange-500 hover:text-orange-300'
              }`}
            >
              WAV
            </button>
            {hasStems && (
              <button
                onClick={() => setSelectedLicense('stems')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg border transition ${
                  selectedLicense === 'stems'
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'border-stone-700 text-stone-400 hover:border-orange-500 hover:text-orange-300'
                }`}
              >
                STEMS
              </button>
            )}
          </div>
        )}

        {alreadyInCart ? (
          <button
            disabled
            className="relative w-full py-3 px-4 font-bold text-stone-500 rounded-lg overflow-hidden cursor-not-allowed border border-stone-700 bg-stone-900/50"
          >
            <span className="relative z-10 flex justify-between items-center px-1">
              <span>🛒 In Cart</span>
              <span className="tabular-nums">KSh {selectedLicense === 'stems' && hasStems ? beat.price_stems : beat.price_wav}</span>
            </span>
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="relative w-full py-3 px-4 font-bold text-white rounded-lg overflow-hidden transition-all duration-100 active:scale-[0.97] active:translate-y-[2px] focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 outline-none touch-manipulation"
          >
            <span
              className="absolute inset-[-2px] z-0 animate-[spin_3s_linear_infinite] motion-reduce:animate-none"
              style={{ background: 'conic-gradient(from 0deg, #13b454)' }}
              aria-hidden="true"
            />
            <span className="absolute inset-[2px] z-0 bg-black rounded-md" aria-hidden="true" />
            <span className="relative z-10 flex justify-between items-center px-1">
              <span>Add to Cart</span>
              <span className="tabular-nums">KSh {selectedLicense === 'stems' && hasStems ? beat.price_stems : beat.price_wav}</span>
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
