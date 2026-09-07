'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CatalogSearch, matchesQuery } from '@/components/CatalogSearch';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { PremiereBadge } from '@/components/store/PremiereBadge';
import { ExplicitBadge } from '@/components/store/ExplicitBadge';
import type { PublicRelease } from '@/lib/store';

// Same rule as /beats: each producer's catalogue is its own section with its
// own search, so looking through one never hides the other.
const PRODUCERS = ['jst.dan', 'tisco prodz'] as const;

export function StoreBrowser({ releases }: { releases: PublicRelease[] }) {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();

  // Play a record straight from the grid. Until now the only way to hear
  // anything in the store was to open a release page first — a shop where you
  // cannot hear the record without committing to a click. Plays track 1, which
  // is the record's own opening statement.
  const playFirstTrack = (e: React.MouseEvent, r: PublicRelease) => {
    e.preventDefault();   // the card is a Link; playing must not navigate
    e.stopPropagation();
    const first = r.tracks[0];
    if (!first?.snippet_url) return;
    if (currentBeatId === first.id && isPlaying) {
      pause();
      return;
    }
    play(first.id, first.snippet_url, first.title, r.cover_art, r.title);
  };

  return (
    <>
      {PRODUCERS.map((producer) => {
        const theirs = releases.filter((r) => r.producer === producer);
        const query = queries[producer] || '';
        const visible = theirs.filter((r) =>
          matchesQuery(query, [r.title, r.artist, r.kind, r.description, ...r.tracks.map((t) => t.title)])
        );

        return (
          <section key={producer} className="mb-14">
            <h2 className="text-2xl font-bold text-orange-100 mb-1">{producer}</h2>
            <p className="text-sm text-stone-600 mb-4">
              {theirs.length} release{theirs.length === 1 ? '' : 's'}
            </p>

            {theirs.length > 0 && (
              <CatalogSearch
                value={query}
                onChange={(v) => setQueries((q) => ({ ...q, [producer]: v }))}
                placeholder={`Search ${producer} — title, artist, song`}
                resultCount={visible.length}
                totalCount={theirs.length}
              />
            )}

            {theirs.length === 0 ? (
              <p className="text-stone-600 text-sm">Nothing from {producer} yet.</p>
            ) : visible.length === 0 ? (
              <p className="text-stone-600 text-sm">
                Nothing in {producer}&apos;s releases matches that.{' '}
                <button
                  onClick={() => setQueries((q) => ({ ...q, [producer]: '' }))}
                  className="text-orange-500 hover:text-orange-400 underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
                >
                  Clear search
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 motion-stagger">
                {visible.map((r) => (
                  <Link
                    key={r.id}
                    href={`/store/${r.id}`}
                    className="group block focus-visible:ring-2 focus-visible:ring-orange-500 rounded-xl outline-none"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-stone-800 mb-3 group-hover:border-stone-600 transition-colors">
                      <Image
                        src={r.cover_art}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover"
                      />
                      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full bg-black/70 text-stone-300">
                        {r.kind}
                      </span>
                      <PremiereBadge premiereAt={r.premiere_at} />
                      <ExplicitBadge explicit={r.explicit} />

                      {/* Stays visible once this record is the one playing —
                          otherwise the only pause control would be off-screen
                          in the bar at the bottom.

                          Absent for a release that has not premiered: the
                          server withholds snippet_url until the date, so there
                          is nothing to play and no button to press. The badge
                          in the corner is what explains the absence. */}
                      {r.tracks[0]?.snippet_url && (
                        <button
                          onClick={(e) => playFirstTrack(e, r)}
                          aria-label={
                            currentBeatId === r.tracks[0].id && isPlaying
                              ? `Pause ${r.title}`
                              : `Play ${r.title}`
                          }
                          data-playing={currentBeatId === r.tracks[0].id && isPlaying}
                          className="absolute bottom-2 right-2 w-11 h-11 grid place-items-center rounded-full bg-orange-600 text-white shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 translate-y-1 group-hover:translate-y-0 transition duration-[var(--dur-2)] ease-[var(--ease-out)] motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none cursor-pointer data-[playing=true]:opacity-100 data-[playing=true]:translate-y-0"
                        >
                          {currentBeatId === r.tracks[0].id && isPlaying ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <rect x="6" y="4" width="4" height="16" rx="1" />
                              <rect x="14" y="4" width="4" height="16" rx="1" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                    <h3 className="font-bold text-orange-100 truncate group-hover:text-orange-300 transition-colors">
                      {r.title}
                    </h3>
                    {r.artist && <p className="text-sm text-stone-500 truncate">{r.artist}</p>}
                    <p className="text-sm text-stone-400 mt-1 tabular-nums">
                      KSh {r.price}
                      <span className="text-stone-600"> · {r.tracks.length} track{r.tracks.length === 1 ? '' : 's'}</span>
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
