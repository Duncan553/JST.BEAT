'use client';

import { useEffect, useState } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { BeatCard } from '@/components/beat-card/BeatCard';
import { Reveal } from '@/components/Reveal';
import { EmptyState } from '@/components/EmptyState';
import Link from 'next/link';
import Image from 'next/image';

// The two catalogues never merge — see the About page and the dashboard, which
// follow the same rule. On this page that shows up as two separate decks, each
// with its own heading and its own "view all", rather than one mixed grid.
const PRODUCERS = [
  {
    name: 'jst.dan' as const,
    // Straight from the About page. Their words, not invented positioning.
    sound: 'Boom bap, drumless and alternative hip-hop.',
  },
  {
    name: 'tisco prodz' as const,
    sound: 'Trap.',
  },
];

const PER_PRODUCER = 4; // one row on desktop, two on a phone

export default function HomePage() {
  const { beats, loading, error, fetchBeats } = useBeatsStore();
  // Whether dollar checkout is actually switched on. The copy below is written
  // from this rather than hard-coded, because a landing page that promises a
  // payment method the checkout refuses is worse than one that stays quiet —
  // and hard-coded copy goes stale the day the key is set. Defaults to false so
  // nothing is promised before the answer arrives.
  const [usdLive, setUsdLive] = useState(false);

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  useEffect(() => {
    let alive = true;
    fetch('/api/payments/methods')
      .then((r) => r.json())
      .then((d) => { if (alive) setUsdLive(Boolean(d?.usd)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const totalBeats = beats.length;

  return (
    <div style={{ background: 'var(--surface-0)' }}>
      {/* ═══ HERO ═══════════════════════════════════════════════════════════
          The wordmark is built in three layers — JST, the photo, BEAT — so the
          picture cuts straight through the middle of it. The old hero was the
          default template shape (headline left, tilted photo right, untilt on
          hover); that tilt is the loudest "made from a template" signal there
          is, which is most of why this page read as cheap.
          Layer mechanics live in .hero-stack in globals.css. */}
      <section className="accent-glow relative overflow-hidden px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-6xl mx-auto grid gap-12 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:items-center">
          <div className="hero-stack motion-rise">
            {/* The h1 carries the whole name for screen readers and search; the
                visible halves are split across two layers, and the front one is
                aria-hidden so nothing is announced twice. */}
            <h1 className="hero-word hero-word--back">
              JST<span className="sr-only">.BEAT</span>
            </h1>

            <figure className="hero-plate">
              <Image
                src="/images/hero-studio.jpg"
                alt="A mixing console mid-session"
                fill
                sizes="(max-width: 768px) 68vw, 420px"
                className="object-cover"
                priority
              />
            </figure>

            <span className="hero-word hero-word--front" aria-hidden="true">
              <span style={{ color: 'var(--accent)' }}>.</span>BEAT
            </span>
          </div>

          <div className="space-y-7">
            <p className="prose-body" style={{ textWrap: 'balance' }}>
              Instrumentals from two producers, sold as WAV or full stems.
              {usdLive
                ? ' Pay in shillings with M-Pesa, or by card in shillings or dollars —'
                : ' Pay in shillings with M-Pesa or by card, and'}{' '}
              the download unlocks the moment it clears.
            </p>

            {/* One primary, one ghost. There used to be four buttons on this
                page and three of them went to /about — a second orange button
                halves the value of the first. */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/beats"
                className="px-7 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-full transition-colors duration-[var(--dur-1)] motion-lift motion-press focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 outline-none touch-manipulation"
                style={{ ['--tw-ring-offset-color' as string]: 'var(--surface-0)' }}
              >
                Browse the catalogue
              </Link>
              <Link
                href="/about"
                className="px-7 py-3.5 border font-bold rounded-full transition-colors duration-[var(--dur-1)] motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation"
                style={{ borderColor: 'var(--line-2)', color: 'var(--text-1)' }}
              >
                Meet the producers
              </Link>
            </div>

            {/* Real numbers or nothing. The count is whatever is actually in the
                table right now — never a hand-typed "50+ beats" that goes stale
                or was never true. */}
            {totalBeats > 0 && (
              <p className="text-sm tabular-nums" style={{ color: 'var(--text-3)' }}>
                {totalBeats} {totalBeats === 1 ? 'beat' : 'beats'}{' · '}2 producers{' · '}WAV &amp; full stems
              </p>
            )}

            {/* Carries the words the display type can't: nobody searches for a
                stylised wordmark. */}
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>
              Buy beats online in Kenya — boom bap, drumless, alternative hip-hop and trap
            </h2>
          </div>
        </div>
      </section>

      {/* ═══ THE CATALOGUE ══════════════════════════════════════════════════ */}
      <section className="px-6 py-16 md:py-24" aria-labelledby="catalogue-heading">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <span className="section-eyebrow">The catalogue</span>
            <h2
              id="catalogue-heading"
              className="font-display font-bold mt-3"
              style={{ fontSize: 'var(--text-h1)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--text-1)' }}
            >
              Two producers,
              <br />
              two separate crates.
            </h2>
            <p className="prose-body mt-4">
              They are kept apart on purpose, so you are never digging through the
              wrong sound to find yours.
            </p>
          </Reveal>

          {error && (
            <div className="mt-10 text-center py-12 border border-red-900/50 rounded-2xl bg-red-950/20" role="alert">
              <p className="text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchBeats()}
                className="text-sm text-orange-400 hover:text-orange-300 underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
              >
                Try again
              </button>
            </div>
          )}

          {/* Skeletons shaped like the real cards, not a centred spinner. */}
          {!error && loading && (
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--line)', background: 'var(--surface-1)' }}>
                  <div className="aspect-square" style={{ background: 'var(--surface-2)' }} />
                  <div className="p-4 space-y-2">
                    <div className="h-3 w-3/4 rounded" style={{ background: 'var(--surface-2)' }} />
                    <div className="h-2 w-1/2 rounded" style={{ background: 'var(--surface-2)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nothing uploaded at all — one honest empty state, not two empty decks. */}
          {!error && !loading && totalBeats === 0 && (
            <div className="mt-12 py-16 border rounded-2xl text-center" style={{ borderColor: 'var(--line)', background: 'var(--surface-1)' }}>
              <EmptyState
                title="No beats up yet"
                body="Boom bap, drumless and trap from two producers. The first drops land here."
                action={{ label: 'Meet the producers', href: '/about' }}
              />
            </div>
          )}

          {!error && !loading && totalBeats > 0 && (
            <div className="mt-14 space-y-16">
              {PRODUCERS.map((producer, i) => {
                const theirs = beats.filter((b) => b.producer === producer.name);
                return (
                  <Reveal key={producer.name} delay={i * 80}>
                    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                      <div>
                        <h3 className="font-display font-bold text-2xl" style={{ color: 'var(--text-1)' }}>
                          {producer.name}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                          {producer.sound}{' '}
                          <span className="tabular-nums">
                            {theirs.length} {theirs.length === 1 ? 'beat' : 'beats'}.
                          </span>
                        </p>
                      </div>
                      {theirs.length > 0 && (
                        <Link
                          href="/beats"
                          className="text-sm font-bold hover:underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
                          style={{ color: 'var(--accent-hot)' }}
                        >
                          All of {producer.name} &rarr;
                        </Link>
                      )}
                    </div>

                    {theirs.length > 0 ? (
                      // motion-stagger cascades the cards 40ms apart. The Reveal
                      // wrapper handles WHEN the row appears; this handles the
                      // order within it.
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 motion-stagger">
                        {theirs.slice(0, PER_PRODUCER).map((beat) => (
                          <BeatCard key={beat.id} beat={beat} />
                        ))}
                      </div>
                    ) : (
                      // One producer has uploaded and the other hasn't. Say so
                      // plainly instead of hiding the deck — a missing section
                      // reads as a bug, an empty one reads as "coming".
                      <p
                        className="text-sm py-8 px-5 rounded-2xl border"
                        style={{ borderColor: 'var(--line)', background: 'var(--surface-1)', color: 'var(--text-3)' }}
                      >
                        Nothing up here yet — {producer.name}&apos;s first drops land in this row.
                      </p>
                    )}
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══ HOW BUYING WORKS ═══════════════════════════════════════════════
          This replaces two full-bleed orange slabs of stock photography. Every
          line below is something the code actually does — no claims I can't
          point at a route for. */}
      <section className="px-6 py-16 md:py-24" style={{ background: 'var(--surface-1)' }} aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <span className="section-eyebrow">How it works</span>
            <h2
              id="how-heading"
              className="font-display font-bold mt-3"
              style={{ fontSize: 'var(--text-h1)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--text-1)' }}
            >
              Three steps, no waiting.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <ol className="grid gap-5 md:grid-cols-3 mt-10 motion-stagger">
              {[
                {
                  n: '01',
                  h: 'Play it first',
                  p: 'Every beat streams from its page with the BPM and key on screen, so you know what you are working with before you spend anything.',
                },
                {
                  n: '02',
                  // Beats are priced in USD either way; what changes is what the
                  // buyer can actually be CHARGED in. Kept in one place so the
                  // two paths can never drift apart in the copy.
                  h: usdLive ? 'Pay in shillings or dollars' : 'Pay in shillings',
                  p: usdLive
                    ? 'Kenyan buyers pay in KSh by M-Pesa or card, converted from the dollar price at the live rate. Everyone else pays the dollar price by card. Whichever you pick, the figure on screen is the figure charged.'
                    : 'M-Pesa or card. Beats are priced in dollars and converted at the live rate, so what the prompt asks for is what the page showed you.',
                },
                {
                  n: '03',
                  h: 'Download straight away',
                  p: 'The WAV, or the full stems if you bought them, unlock the moment the payment clears. Nothing gets emailed to you later.',
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="p-6 rounded-2xl border"
                  style={{ borderColor: 'var(--line)', background: 'var(--surface-0)' }}
                >
                  <span className="font-display font-bold text-2xl tabular-nums" style={{ color: 'var(--accent-hot)' }}>
                    {step.n}
                  </span>
                  <h3 className="font-display font-bold text-lg mt-3" style={{ color: 'var(--text-1)' }}>
                    {step.h}
                  </h3>
                  <p className="text-sm leading-relaxed mt-2" style={{ color: 'var(--text-2)' }}>
                    {step.p}
                  </p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ═══ CUSTOM WORK ════════════════════════════════════════════════════ */}
      <section className="px-6 py-20 md:py-28">
        <Reveal className="max-w-2xl mx-auto text-center">
          <h2
            className="font-display font-bold"
            style={{ fontSize: 'var(--text-h1)', lineHeight: 1.08, letterSpacing: '-0.03em', color: 'var(--text-1)' }}
          >
            Or have one made for you.
          </h2>
          <p className="prose-body mx-auto mt-4">
            Both producers take custom work — a beat built around your reference,
            your key, your tempo. Message either of them and talk it through.
          </p>
          <Link
            href="/about"
            className="inline-block mt-8 px-7 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-full transition-colors duration-[var(--dur-1)] motion-lift motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation"
          >
            Talk to a producer
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
