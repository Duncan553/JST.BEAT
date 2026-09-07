'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { premiereState, formatCountdown, formatPremiereDate } from '@/lib/premiere';

/**
 * The "why can't I download this" dialog.
 *
 * Two things it has to say, depending on the record:
 *   - ordinary release  → playing is free, the files are paid
 *   - before a premiere → the same, PLUS the date, and that buying skips the wait
 *
 * PORTALED TO document.body, deliberately. The site's player bar uses
 * `backdrop-blur`, and any ancestor with backdrop-filter/filter/transform
 * becomes the containing block for `position: fixed` descendants — a
 * "full-screen" overlay nested inside one is silently fixed to that element
 * instead of the viewport. Rendering through a portal is what makes the
 * position:fixed here mean the actual screen.
 */
export function TrackGateModal({
  open,
  onClose,
  onBuy,
  trackTitle,
  releaseTitle,
  price,
  premiereAt,
  alreadyInCart,
}: {
  open: boolean;
  onClose: () => void;
  onBuy: () => void;
  trackTitle: string;
  releaseTitle: string;
  price: number;
  premiereAt: string | null;
  alreadyInCart: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and the page behind must not scroll while it is open —
  // a modal you can scroll out from under is the classic broken one.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus in, so a keyboard user isn't left behind the overlay.
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  // createPortal needs a real DOM node; on the server there isn't one.
  if (typeof document === 'undefined') return null;

  const premiere = premiereState(premiereAt);
  const upcoming = premiere.status === 'upcoming';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      // Backdrop click closes — but only when the backdrop itself was hit, not
      // when a click inside the panel bubbles up to here.
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm motion-rise" aria-hidden="true" />

      <div
        ref={panelRef}
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border p-6 motion-rise max-h-[90dvh] overflow-y-auto"
        // dvh, not vh: on a phone `vh` ignores the browser's own collapsing
        // toolbar, so a sheet capped at 90vh can still push its buttons under
        // the address bar. Without a cap at all, the buy button on a short
        // phone would sit below the fold with nothing to scroll — the sheet is
        // the scroll container, since the page behind it is locked.
        style={{ background: 'var(--surface-1)', borderColor: 'var(--line)' }}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-full transition-colors duration-[var(--dur-1)] focus-visible:ring-2 focus-visible:ring-orange-500 outline-none cursor-pointer"
          style={{ color: 'var(--text-3)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {upcoming && premiere.status === 'upcoming' && (
          <span
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide mb-4"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-hot)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
            Premieres in {formatCountdown(premiere.msRemaining)}
          </span>
        )}

        <h2
          id="gate-title"
          className="font-display font-bold text-2xl mb-2 pr-8"
          style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}
        >
          {upcoming ? 'Not out yet' : 'Pay to download'}
        </h2>

        <p className="text-sm leading-relaxed mb-1" style={{ color: 'var(--text-2)' }}>
          <span style={{ color: 'var(--text-1)' }}>{trackTitle}</span>
          <span style={{ color: 'var(--text-3)' }}> · {releaseTitle}</span>
        </p>

        <p className="text-sm leading-relaxed mt-4" style={{ color: 'var(--text-2)' }}>
          {upcoming && premiere.status === 'upcoming' ? (
            <>
              This record premieres on{' '}
              <strong style={{ color: 'var(--text-1)' }}>{formatPremiereDate(premiere.at)}</strong>.
              Until then nobody can play it — on the date it unlocks and streams free for
              everyone, forever. Buying now is how you get it{' '}
              <strong style={{ color: 'var(--text-1)' }}>today</strong>, before anyone else
              has heard it.
            </>
          ) : (
            <>
              Playing is free, the whole record, as many times as you like. The download is the
              original master — that&apos;s the part you buy, and it covers every track on{' '}
              <strong style={{ color: 'var(--text-1)' }}>{releaseTitle}</strong>, not just this one.
            </>
          )}
        </p>

        <div className="flex items-baseline justify-between mt-6 mb-4">
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
            {upcoming ? 'Early access' : 'Whole release'}
          </span>
          <span className="font-display font-bold text-2xl tabular-nums" style={{ color: 'var(--text-1)' }}>
            KSh {price}
          </span>
        </div>

        <button
          onClick={onBuy}
          disabled={alreadyInCart}
          className="w-full py-3 rounded-full font-bold transition-colors duration-[var(--dur-1)] motion-press disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation"
          style={
            alreadyInCart
              ? { background: 'var(--surface-2)', color: 'var(--text-3)' }
              : { background: 'var(--accent)', color: '#fff' }
          }
        >
          {alreadyInCart ? 'Already in your cart' : `Buy to download — KSh ${price}`}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm rounded-full transition-colors duration-[var(--dur-1)] focus-visible:ring-2 focus-visible:ring-orange-500 outline-none cursor-pointer"
          style={{ color: 'var(--text-3)' }}
        >
          {upcoming ? 'Wait for the premiere' : 'Keep listening for free'}
        </button>
      </div>
    </div>,
    document.body
  );
}
