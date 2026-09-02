'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The slide-out navigation panel.
 *
 * Replaces the old inline dropdown, which pushed the page down and listed
 * everything as one flat run of links — you had to read all of them to find
 * the one you wanted. A drawer sits ON TOP of the page instead, so nothing
 * reflows, and the links are grouped so a destination can be found by
 * scanning group headings rather than every item.
 *
 * The panel is always in the DOM (translated off-screen when closed) so it
 * can animate in and out; `inert`-style guards below keep it out of reach of
 * keyboard and screen readers while it's closed.
 */

interface NavItem {
  href: string;
  label: string;
  hint?: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  footer?: React.ReactNode;
}

export function NavDrawer({ open, onClose, groups, footer }: Props) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes it. Without this the only way out on a phone is the X or
  // the backdrop, and both are easy to miss mid-scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Stop the page behind the drawer from scrolling while it's open —
  // otherwise a swipe on the overlay scrolls the storefront underneath.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Move focus into the panel when it opens so the keyboard follows the eye.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Backdrop. Fades rather than snapping, and is click-to-close. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity duration-[var(--dur-2)] ease-[var(--ease-out)] ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        tabIndex={-1}
        // Slides in from the right — that's the side the thumb holding the
        // phone is already on, and the same side the hamburger sits.
        className={`md:hidden fixed top-0 right-0 bottom-0 z-[60] w-[78%] max-w-xs bg-stone-950 border-l border-stone-800 shadow-2xl shadow-black/60 transition-transform duration-[var(--dur-3)] ease-[var(--ease-out)] outline-none flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        // Fully out of the tab order and off the accessibility tree when shut.
        // React 19 takes a real boolean here; an empty string logs a warning
        // and, worse, is read as false.
        inert={!open}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-stone-800 shrink-0">
          <span className="text-lg font-black tracking-tighter text-white">
            JST<span className="text-orange-500">.</span>BEAT
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-900 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* The links. Scrollable, because a long list on a short phone screen
            must not trap the last item below the fold. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {groups.map((group) => (
            <div key={group.heading}>
              <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        // min-h-12 keeps every row a comfortable thumb target.
                        className={`flex flex-col justify-center min-h-12 px-3 rounded-xl transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-orange-500 outline-none ${
                          active
                            ? 'bg-orange-950/40 text-orange-300'
                            : 'text-stone-300 hover:bg-stone-900 hover:text-white'
                        }`}
                      >
                        <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
                        {/* One line saying what's actually there — the reason
                            "Art Museum" or "Reviews" gets found at all. */}
                        {item.hint && (
                          <span className="text-[11px] text-stone-500 leading-tight mt-0.5">{item.hint}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {footer && <div className="border-t border-stone-800 p-4 shrink-0">{footer}</div>}
      </div>
    </>
  );
}
