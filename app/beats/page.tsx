'use client';

import { useEffect } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { BeatChip } from '@/components/beat-chip/BeatChip';
import Link from 'next/link';

export default function BeatsPage() {
  const { beats, loading, error, fetchBeats } = useBeatsStore();

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      {/* Title */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-orange-50 mb-2">
          All Beats
        </h1>
        <p className="text-stone-500">Browse the full catalog. Click any beat to explore.</p>
      </div>

      {/* Beats */}
      <div className="max-w-6xl mx-auto px-6">
        {error && (
          <div className="text-center py-12 border border-red-900/50 rounded-xl bg-red-950/20" role="alert">
            <p className="text-red-400 text-lg mb-2">{error}</p>
            <button 
              onClick={() => fetchBeats()}
              className="text-sm text-orange-400 hover:text-orange-300 underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            >
              Refresh page to try again
            </button>
          </div>
        )}

        {!error && loading ? (
          <div className="flex flex-wrap gap-3 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-stone-800 bg-stone-900/40">
                <div className="w-8 h-8 rounded-full bg-stone-800" />
                <div className="w-20 h-3 bg-stone-800 rounded" />
              </div>
            ))}
          </div>
        ) : !error && beats.length === 0 ? (
          <div className="text-center py-20 border border-stone-800 rounded-xl bg-stone-900/30">
            <p className="text-stone-500 text-lg">No beats available yet.</p>
            <p className="text-stone-600 text-sm mt-2">Check back soon for new drops.</p>
            <Link 
              href="/contact" 
              className="inline-block mt-4 text-orange-500 hover:text-orange-400 text-sm underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            >
              Request a custom beat instead
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {beats.map((beat) => (
              <BeatChip key={beat.id} beat={beat} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
