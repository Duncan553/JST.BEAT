'use client';

import { useEffect, useState } from 'react';
import { premiereState, formatCountdown, countdownTickMs, formatPremiereDate } from '@/lib/premiere';

/**
 * "Premieres in 6 days" — the countdown, wherever a release is shown.
 *
 * Rendered client-side on purpose. The server would bake in whatever "now" was
 * at build or request time, and a cached page would then show a stale
 * countdown; the browser is the only place that reliably knows the current
 * moment. That means it renders nothing on the first paint — which is correct,
 * because a badge that flashes the wrong number is worse than one that arrives
 * a frame late.
 */
export function PremiereBadge({
  premiereAt,
  variant = 'overlay',
}: {
  premiereAt: string | null;
  /** overlay = on top of cover art in the grid; inline = in a page's text flow. */
  variant?: 'overlay' | 'inline';
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  // Re-tick at a rate matched to the size of the remaining time — hourly a week
  // out, every 30s in the final hour. A fixed 1s interval would re-render this
  // 3,600 times an hour to change a number that moves once.
  useEffect(() => {
    if (!now) return;
    const state = premiereState(premiereAt, now);
    if (state.status !== 'upcoming') return;
    const id = setTimeout(() => setNow(new Date()), countdownTickMs(state.msRemaining));
    return () => clearTimeout(id);
  }, [now, premiereAt]);

  if (!now) return null;
  const state = premiereState(premiereAt, now);
  if (state.status !== 'upcoming') return null;

  const remaining = formatCountdown(state.msRemaining);
  const label = `Premieres in ${remaining}`;
  // The countdown says how long; the title says exactly when. A countdown alone
  // cannot be put in a calendar.
  const exact = formatPremiereDate(state.at);

  if (variant === 'inline') {
    return (
      <span
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent-hot)' }}
        title={exact}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
        {label} · {exact}
      </span>
    );
  }

  return (
    <span
      className="absolute top-2 right-2 max-w-[calc(100%-1rem)] px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wide bg-black/80 backdrop-blur-sm whitespace-nowrap"
      style={{ color: 'var(--accent-hot)' }}
      title={exact}
      aria-label={label}
    >
      {/* On a phone the card is ~160px wide and the full phrase ran to about
          three quarters of it, straight into the ALBUM chip on the left. The
          countdown is the information; "Premieres" is the part that can go. */}
      <span className="sm:hidden">{remaining}</span>
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
