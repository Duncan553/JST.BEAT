'use client';

import { useState, useEffect } from 'react';
import { Beat } from '@/types/beat';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useCartStore } from '@/stores/useCartStore';

interface BeatCardProps {
  beat: Beat;
}

export function BeatCard({ beat }: BeatCardProps) {
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();
  const { addItem, isInCart } = useCartStore();
  const isThisPlaying = currentBeatId === beat.id && isPlaying;
  
  // Start false so server and client render the SAME button first
  const [alreadyInCart, setAlreadyInCart] = useState(false);

  // After hydration, check the real cart state
  useEffect(() => {
    setAlreadyInCart(isInCart(beat.id));
  }, [isInCart, beat.id]);

  const handlePlay = () => {
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url);
  };

  const handleAddToCart = () => {
    if (alreadyInCart) return;
    addItem(beat, 'wav');
    setAlreadyInCart(true);
  };

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition bg-white">
      <a href={`/beats/${beat.id}`}>
        <div
          className="aspect-square bg-gray-900 flex items-center justify-center text-white"
          style={{
            backgroundImage: `url(${beat.cover_art})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!beat.cover_art && <span className="text-lg font-bold">{beat.title}</span>}
        </div>
      </a>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <a href={`/beats/${beat.id}`}>
            <h3 className="font-bold text-lg hover:underline">{beat.title}</h3>
          </a>
          <span className="text-sm text-gray-500">{beat.bpm} BPM</span>
        </div>
        <div className="flex gap-2 text-sm text-gray-600 mb-4">
          <span>{beat.genre}</span>
          <span>•</span>
          <span>{beat.key}</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-4">
          {beat.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-1 bg-gray-100 rounded">
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={handlePlay}
          className="w-full py-2 bg-black text-white rounded mb-3 hover:bg-gray-800 transition"
        >
          {isThisPlaying ? '⏸ Pause' : '▶ Play Snippet'}
        </button>

        {alreadyInCart ? (
          <button
            disabled
            className="relative w-full py-3 px-4 font-bold text-gray-400 rounded-lg overflow-hidden cursor-not-allowed"
          >
            <span className="absolute inset-[2px] z-0 bg-gray-100 rounded-md border border-gray-300" />
            <span className="relative z-10 flex justify-between items-center px-1">
              <span>✓ In Cart</span>
              <span>KSh {beat.price_wav}</span>
            </span>
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="relative w-full py-3 px-4 font-bold text-white rounded-lg overflow-hidden transition-all duration-100 active:scale-[0.97] active:translate-y-[2px]"
          >
            <span
              className="absolute inset-[-2px] z-0 animate-[spin_3s_linear_infinite]"
              style={{
                background: 'conic-gradient(from 0deg,  #ff4545)',
              }}
            />
            <span className="absolute inset-[2px] z-0 bg-black rounded-md" />
            <span className="relative z-10 flex justify-between items-center px-1">
              <span>Add to Cart</span>
              <span>KSh {beat.price_wav}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
