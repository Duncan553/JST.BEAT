import Link from 'next/link';

/**
 * The one empty state.
 *
 * Every empty view on this site used to be two greyed-out sentences ending in
 * "Check back soon." — a dead end that makes a working site look unfinished.
 * An empty state has one job: say what belongs here, and give the one thing
 * worth doing instead. See .claude/skills/design/SKILL.md.
 */

interface Props {
  /** What would be here. One short line, sentence case. */
  title: string;
  /** Why it's empty, or what to expect. Optional — don't pad it. */
  body?: string;
  /** The way out. Every dead end should have one. */
  action?: { label: string; href: string };
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <div
      className="rounded-2xl border px-6 py-14 text-center motion-rise"
      style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface-1)' }}
    >
      {/* A quiet mark rather than a big illustration — it fills the space
          without pretending something went wrong. */}
      <div
        className="mx-auto mb-5 w-11 h-11 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--accent-soft)' }}
        aria-hidden="true"
      >
        <svg className="w-5 h-5" fill="none" stroke="var(--accent-hot)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M9 19V6l11-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      <p className="font-display text-xl font-bold" style={{ color: 'var(--text-1)' }}>{title}</p>
      {body && (
        <p className="mt-2 mx-auto text-sm" style={{ color: 'var(--text-3)', maxWidth: '38ch' }}>{body}</p>
      )}

      {action && (
        <Link
          href={action.href}
          className="inline-block mt-6 px-6 py-3 rounded-full font-bold text-sm bg-orange-600 text-white hover:bg-orange-500 transition-colors duration-[var(--dur-1)] motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
