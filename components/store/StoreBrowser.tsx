'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CatalogSearch, matchesQuery } from '@/components/CatalogSearch';
import type { PublicRelease } from '@/lib/store';

// Same rule as /beats: each producer's catalogue is its own section with its
// own search, so looking through one never hides the other.
const PRODUCERS = ['jst.dan', 'tisco prodz'] as const;

export function StoreBrowser({ releases }: { releases: PublicRelease[] }) {
  const [queries, setQueries] = useState<Record<string, string>>({});

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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
