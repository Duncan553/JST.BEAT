/**
 * PREMIERE WINDOWS — one place, so the store page, the grid badge and the
 * dashboard can never disagree about what "premiering" means.
 *
 * The state machine is deliberately tiny, because the store's real rule is
 * already enforced elsewhere and does not change here:
 *
 *   streaming  — always free, whole record, before and after a premiere
 *   download   — always paid, always via /api/orders/download after a paid order
 *
 * `premiere_at` adds a DATE, not a lock. Before it passes, the record carries a
 * countdown and buying gets you the file early; after it passes, the release is
 * an ordinary catalogue item. See docs/TODO.md §7b for why a dated event is the
 * thing that does the work.
 */

export type PremiereState =
  | { status: 'none' }                                  // ordinary release
  | { status: 'upcoming'; at: Date; msRemaining: number }
  | { status: 'released'; at: Date };                   // premiere has passed

/**
 * `now` is injectable so this is testable and so a server render and the
 * browser can be handed the same instant instead of drifting apart.
 */
export function premiereState(premiereAt: string | null | undefined, now: Date = new Date()): PremiereState {
  if (!premiereAt) return { status: 'none' };

  const at = new Date(premiereAt);
  // A malformed date must not take the store page down — treat it as no
  // premiere, which is the behaviour every existing row already has.
  if (Number.isNaN(at.getTime())) return { status: 'none' };

  const msRemaining = at.getTime() - now.getTime();
  return msRemaining > 0
    ? { status: 'upcoming', at, msRemaining }
    : { status: 'released', at };
}

/**
 * "6 days", "4 hours", "12 minutes", "under a minute".
 *
 * One unit only. A countdown reading "6 days 4 hours 12 minutes 9 seconds" is
 * a stopwatch, and a ticking seconds field forces a re-render every second for
 * information nobody acts on a week out. The unit coarsens as the date nears,
 * which is where precision actually starts to matter.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'under a minute';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  // ROUND for days, floor for everything smaller. A date set exactly a week out
  // is already 6 days 23h 59m away by the time the page renders, and flooring
  // that showed "6 days" the instant the artist saved "7 days from now" —
  // which reads as a bug. Rounding is never more than half a day out, and the
  // hour and minute buckets above take over long before that matters.
  const days = Math.round(ms / 86400000);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** How often a countdown of this size needs to redraw to stay honest. */
export function countdownTickMs(ms: number): number {
  if (ms <= 0) return 0;
  if (ms < 60 * 60 * 1000) return 30 * 1000;   // under an hour: every 30s
  if (ms < 24 * 60 * 60 * 1000) return 60 * 1000; // under a day: every minute
  return 60 * 60 * 1000;                        // otherwise: hourly is plenty
}

/** Absolute date for the tooltip/detail line — a countdown alone hides WHEN. */
export function formatPremiereDate(at: Date): string {
  return at.toLocaleString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  });
}
