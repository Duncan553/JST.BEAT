'use client';

import { useEffect } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { BeatChip } from '@/components/beat-chip/BeatChip';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const { beats, loading, error, fetchBeats } = useBeatsStore();

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  // Landing page teases the catalog, doesn't replace it — aims for 2 from
  // each producer, "View All" sends them to the full individual catalogs.
  // Backfills from whichever producer has more so the homepage doesn't go
  // sparse just because one of them has fewer (or zero, e.g. before the
  // producer migration has run) beats tagged yet.
  const TARGET_PREVIEW_COUNT = 4;
  let previewBeats = [
    ...beats.filter((b) => b.producer === 'jst.dan').slice(0, 2),
    ...beats.filter((b) => b.producer === 'tisco prodz').slice(0, 2),
  ];
  if (previewBeats.length < TARGET_PREVIEW_COUNT) {
    const usedIds = new Set(previewBeats.map((b) => b.id));
    const extra = beats.filter((b) => !usedIds.has(b.id)).slice(0, TARGET_PREVIEW_COUNT - previewBeats.length);
    previewBeats = [...previewBeats, ...extra];
  }

  return (
    <div className="space-y-0">
      {/* HERO */}
      {/* accent-glow puts ONE soft orange wash behind the hero. One per page —
          a glow per section is what makes a site look like a template. */}
      <section className="accent-glow relative text-white overflow-hidden" style={{ background: 'var(--surface-0)' }}>
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 z-10">
            <h1
              className="font-display font-extrabold"
              style={{ fontSize: 'var(--text-hero)', letterSpacing: '-0.045em', lineHeight: 1.02, textWrap: 'balance' }}
            >
              JST<span className="text-orange-500">.</span>BEAT
            </h1>
            {/* prose-body: 17px, 1.6 leading, 62ch cap, and the brighter
                secondary colour — stone-400 on black read as disabled text. */}
            <p className="prose-body" style={{ textWrap: 'balance' }}>
              Boom bap, drumless, alternative hip-hop and trap from{' '}
              <span style={{ color: 'var(--accent-hot)' }}>jst.dan</span> and{' '}
              <span style={{ color: 'var(--accent-hot)' }}>tisco prodz</span>. Pay with M-Pesa,
              download the WAV or full stems the moment it clears.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/beats"
                className="group relative px-8 py-3.5 bg-orange-600 text-white font-bold rounded-full overflow-hidden motion-lift motion-press focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                <span className="relative z-10">Browse All Beats</span>
                <span className="absolute inset-0 bg-orange-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 motion-reduce:transition-none" />
              </Link>
              <Link
                href="/about"
                className="px-8 py-3.5 border font-bold rounded-full motion-lift motion-press focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
                style={{ borderColor: 'var(--line)', color: 'var(--text-1)' }}
              >
                Meet the producers
              </Link>
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="relative aspect-[3/2] rounded-2xl overflow-hidden border border-stone-800 rotate-2 hover:rotate-0 transition-transform duration-500 motion-reduce:transition-none motion-reduce:rotate-0">
              <Image
                src="/images/hero-studio.jpg"
                alt="Studio mixing console with colorful LED lights"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-orange-600 rounded-full blur-3xl opacity-40" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* EDITORIAL SECTION 1 */}
      <section className="bg-orange-700 text-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="relative aspect-[3/2] rounded-2xl overflow-hidden shadow-2xl rotate-[-1deg] hover:rotate-0 transition-transform duration-500 motion-reduce:transition-none motion-reduce:rotate-0 border-4 border-orange-800">
              <Image
                src="/images/editorial-vinyl.jpg"
                alt="Person browsing through vinyl records at a market"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 
              className="font-display font-bold"
              style={{ fontSize: 'var(--text-h1)', textWrap: 'balance' }}
            >
              Two producers.
               <br />
               Two catalogues.
            </h2>
            <p 
              className="text-orange-100 leading-relaxed max-w-md"
              style={{ textWrap: 'balance' }}
            >
              jst.dan works in boom bap, drumless and alternative hip-hop.
              tisco prodz builds trap. They're kept as separate catalogues so
              you're not digging through the wrong sound to find yours.
            </p>
            <Link
              href="/beats"
              className="inline-block px-6 py-2 border border-white/30 rounded-full text-sm font-medium hover:bg-white hover:text-orange-700 transition focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-700 outline-none touch-manipulation"
            >
              Browse both catalogues &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* EDITORIAL SECTION 2 */}
      <section className="bg-black text-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1">
            <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-stone-800 hover:border-orange-900/50 transition-colors duration-500">
              <Image
                src="/images/editorial-records.jpg"
                alt="Colorful vinyl records on album covers"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 
              className="font-display font-bold text-orange-50"
              style={{ fontSize: 'var(--text-h1)', textWrap: 'balance' }}
            >
              Mixed. Mastered.
              <br />
              <span className="text-orange-500">Ready to release.</span>
            </h2>
            <p 
              className="text-stone-400 leading-relaxed max-w-md"
              style={{ textWrap: 'balance' }}
            >
              Every beat ships mixed and mastered, with the BPM and key on the page
              so you know what you&apos;re working with before you buy. Add vocals and
              put it out — no extra engineering, no waiting.
            </p>
            <Link
              href="/about"
              className="inline-block px-6 py-2 bg-orange-600 rounded-full text-sm font-bold hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
            >
              Custom Orders
            </Link>
          </div>
        </div>
      </section>

      {/* BEATS PREVIEW - Only 5 on landing page */}
      <section id="beats" className="bg-black py-20 px-6" aria-labelledby="beats-heading">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 
                id="beats-heading"
                className="text-3xl font-bold tracking-tight text-orange-50"
                style={{ textWrap: 'balance' }}
              >
                Fresh Drops
              </h2>
              <p className="text-stone-500 mt-2">Newest instrumentals, WAV and stems</p>
            </div>
            <Link 
              href="/beats"
              className="text-sm text-orange-500 hover:text-orange-400 font-bold hover:underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            >
              View All &rarr;
            </Link>
          </div>

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
              {[1, 2, 3, 4].map((n) => (
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
            <>
              <div className="flex flex-wrap gap-3">
                {previewBeats.map((beat) => (
                  <BeatChip key={beat.id} beat={beat} />
                ))}
              </div>
              {beats.length > previewBeats.length && (
                <div className="mt-8 text-center">
                  <Link
                    href="/beats"
                    className="inline-flex items-center gap-2 px-6 py-3 border border-stone-700 rounded-full text-stone-400 hover:text-white hover:border-orange-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                  >
                    View all {beats.length} beats
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="bg-orange-700 text-white py-20 px-6 text-center">
        <h2 
          className="text-3xl md:text-4xl font-bold mb-4"
          style={{ textWrap: 'balance' }}
        >
          Want something made for you?
        </h2>
        <p 
          className="text-orange-100 mb-8 max-w-md mx-auto"
          style={{ textWrap: 'balance' }}
        >
          Both producers take custom work — a beat built around your reference,
          your key, your tempo. Message either of us and we&apos;ll talk it through.
        </p>
        <Link
          href="/about"
          className="inline-block bg-white text-orange-700 px-8 py-3 rounded-full font-bold hover:bg-orange-100 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-700 outline-none touch-manipulation"
        >
          Talk to a producer
        </Link>
      </section>
    </div>
  );
}
