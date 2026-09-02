'use client';

/**
 * A search box scoped to ONE catalogue section.
 *
 * The point of the /beats page is that the two producers stay separate, so a
 * single site-wide search would undo that — you'd be back to one merged list.
 * Each section owns its own box and filters only its own beats.
 */
export function CatalogSearch({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  resultCount: number;
  totalCount: number;
}) {
  return (
    <div className="mb-4">
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 pointer-events-none" aria-hidden="true">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-stone-900/60 border border-stone-800 rounded-full pl-9 pr-9 py-2 text-sm text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-stone-500 hover:text-stone-200 rounded-full focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
          >
            ×
          </button>
        )}
      </div>
      {value && (
        // aria-live so a screen reader hears the count change as you type.
        <p className="text-xs text-stone-500 mt-2" aria-live="polite">
          {resultCount} of {totalCount} match &ldquo;{value}&rdquo;
        </p>
      )}
    </div>
  );
}

/** Matches across every field someone might actually type. */
export function matchesQuery(query: string, fields: Array<string | number | string[] | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // Every word must appear somewhere, so "dark 140" narrows rather than widens.
  const words = q.split(/\s+/);
  const haystack = fields
    .flatMap((f) => (Array.isArray(f) ? f : [f]))
    .filter((f) => f !== null && f !== undefined)
    .join(' ')
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}
