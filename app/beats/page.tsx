'use client';

import { useEffect, useState } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { BeatChip } from '@/components/beat-chip/BeatChip';
import { Beat } from '@/types/beat';
import { CatalogSearch, matchesQuery } from '@/components/CatalogSearch';
import Link from 'next/link';

const PRODUCERS = ['jst.dan', 'tisco prodz'] as const;

export default function BeatsPage() {
  const { beats, loading, error, fetchBeats } = useBeatsStore();
  // One query per producer, so searching jst.dan's catalogue never hides
  // tisco's — the two lists stay independent, which is the whole point.
  const [queries, setQueries] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  return (
    <div className="min-h-screen bg-black text-white pb-48 md:pb-32">
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
        <p className="text-stone-500">Two producers, two individual catalogs. Click any beat to explore.</p>
      </div>

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
              href="/about"
              className="inline-block mt-4 text-orange-500 hover:text-orange-400 text-sm underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            >
              Request a custom beat instead
            </Link>
          </div>
        ) : (
          // Each producer gets their own section — catalogs stay separate,
          // never merged into one flat list.
          PRODUCERS.map((producer) => {
            const producerBeats = beats.filter((b: Beat) => b.producer === producer);
            const query = queries[producer] || '';
            const visible = producerBeats.filter((b: Beat) =>
              matchesQuery(query, [b.title, b.genre, b.key, b.bpm, b.tags])
            );
            return (
              <div key={producer} className="mb-14">
                <h2 className="text-2xl font-bold text-orange-100 mb-1">{producer}</h2>
                <p className="text-sm text-stone-600 mb-4">
                  {producerBeats.length} beat{producerBeats.length === 1 ? '' : 's'}
                </p>

                {producerBeats.length > 0 && (
                  <CatalogSearch
                    value={query}
                    onChange={(v) => setQueries((q) => ({ ...q, [producer]: v }))}
                    placeholder={`Search ${producer} — title, genre, key, BPM`}
                    resultCount={visible.length}
                    totalCount={producerBeats.length}
                  />
                )}

                {producerBeats.length === 0 ? (
                  <p className="text-stone-600 text-sm">No beats from {producer} yet.</p>
                ) : visible.length === 0 ? (
                  <p className="text-stone-600 text-sm">
                    Nothing in {producer}&apos;s catalogue matches that.{' '}
                    <button
                      onClick={() => setQueries((q) => ({ ...q, [producer]: '' }))}
                      className="text-orange-500 hover:text-orange-400 underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
                    >
                      Clear search
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {visible.map((beat) => (
                      <BeatChip key={beat.id} beat={beat} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
