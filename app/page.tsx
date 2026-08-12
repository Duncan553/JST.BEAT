'use client';

import { useEffect } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { BeatChip } from '@/components/beat-chip/BeatChip';
import Link from 'next/link';

export default function HomePage() {
  const { beats, loading, error, fetchBeats } = useBeatsStore();

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  // Only show first 5 beats on landing page
  const previewBeats = beats.slice(0, 5);

  return (
    <div className="space-y-0">
      {/* HERO */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 z-10">
            <h1 
              className="text-6xl md:text-8xl font-black tracking-tighter leading-none"
              style={{ textWrap: 'balance' }}
            >
              JST<span className="text-orange-500">.</span>BEAT
            </h1>
            <p 
              className="text-xl text-stone-400 max-w-md leading-relaxed"
              style={{ textWrap: 'balance' }}
            >
              Premium beats for artists and producers. Buy exclusive WAV leases and
              make your next hit.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/beats"
                className="group relative px-8 py-3 bg-orange-600 text-white font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                <span className="relative z-10">Browse All Beats</span>
                <span className="absolute inset-0 bg-orange-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 motion-reduce:transition-none" />
              </Link>
              <Link
                href="/about"
                className="px-8 py-3 border border-stone-700 text-stone-300 font-bold rounded-full hover:border-orange-500 hover:text-orange-300 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
              >
                About Me
              </Link>
            </div>
          </div>

          <div className="flex-1 relative">
            <div className="relative rounded-2xl overflow-hidden border border-stone-800 rotate-2 hover:rotate-0 transition-transform duration-500 motion-reduce:transition-none motion-reduce:rotate-0">
              <img
                src="/images/hero-studio.jpg"
                alt="Studio mixing console with colorful LED lights"
                className="w-full h-auto object-cover"
                loading="eager"
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
            <div className="rounded-2xl overflow-hidden shadow-2xl rotate-[-1deg] hover:rotate-0 transition-transform duration-500 motion-reduce:transition-none motion-reduce:rotate-0 border-4 border-orange-800">
              <img
                src="/images/editorial-vinyl.jpg"
                alt="Person browsing through vinyl records at a market"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 
              className="text-4xl md:text-5xl font-serif italic tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Find what&apos;s on
              <br />
              your mind.
            </h2>
            <p 
              className="text-orange-100 leading-relaxed max-w-md"
              style={{ textWrap: 'balance' }}
            >
              Every beat starts with a feeling. Dig through the catalog and find the
              one that matches your vision — from dark trap to melodic afro.
            </p>
            <Link
              href="/beats"
              className="inline-block px-6 py-2 border border-white/30 rounded-full text-sm font-medium hover:bg-white hover:text-orange-700 transition focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-700 outline-none touch-manipulation"
            >
              Explore Sounds &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* EDITORIAL SECTION 2 */}
      <section className="bg-black text-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1">
            <div className="rounded-2xl overflow-hidden border border-stone-800 hover:border-orange-900/50 transition-colors duration-500">
              <img
                src="/images/editorial-records.jpg"
                alt="Colorful vinyl records on album covers"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 
              className="text-4xl md:text-5xl font-serif italic tracking-tight text-orange-50"
              style={{ textWrap: 'balance' }}
            >
              Easily play an
              <br />
              <span className="text-orange-500">F# minor Jazz.</span>
            </h2>
            <p 
              className="text-stone-400 leading-relaxed max-w-md"
              style={{ textWrap: 'balance' }}
            >
              All beats are mixed and mastered ready for your vocals. Just add your
              voice and release. No extra engineering needed.
            </p>
            <Link
              href="/contact"
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
              <p className="text-stone-500 mt-2">Latest beats from the studio</p>
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
              {[1, 2, 3, 4, 5].map((n) => (
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
            <>
              <div className="flex flex-wrap gap-3">
                {previewBeats.map((beat) => (
                  <BeatChip key={beat.id} beat={beat} />
                ))}
              </div>
              {beats.length > 5 && (
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
          Want Custom Beats?
        </h2>
        <p 
          className="text-orange-100 mb-8 max-w-md mx-auto"
          style={{ textWrap: 'balance' }}
        >
          I also take custom orders. Hit me up and let&apos;s cook something unique.
        </p>
        <Link
          href="/contact"
          className="inline-block bg-white text-orange-700 px-8 py-3 rounded-full font-bold hover:bg-orange-100 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-orange-700 outline-none touch-manipulation"
        >
          Get In Touch
        </Link>
      </section>
    </div>
  );
}
