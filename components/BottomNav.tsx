'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/useCartStore';

/**
 * Mobile primary navigation.
 *
 * Why this exists: the site was hamburger-only on phones, and hiding
 * navigation behind an icon measurably reduces discoverability — people
 * don't tap what they can't see. Both Material Design and Apple's HIG put
 * primary destinations in a bottom bar because that's where the thumb
 * already is on a one-handed grip.
 *
 * Four destinations, which is inside the 3–5 a tab bar can carry. Everything
 * secondary (About, Art Museum, Dashboard, Login) stays in the header menu.
 *
 * Sits at bottom-0; the audio player is pushed up to bottom-16 on mobile so
 * the two don't fight for the same strip of screen.
 */

const ITEMS = [
  {
    href: '/beats',
    label: 'Beats',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19V6l11-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z" />
    ),
  },
  {
    href: '/store',
    label: 'Store',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3A1 1 0 005.4 17H17M17 17a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    ),
  },
  {
    href: '/blog',
    label: 'Reviews',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    ),
  },
  {
    href: '/cart',
    label: 'Cart',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { items } = useCartStore();
  const [mounted, setMounted] = useState(false);

  // The cart lives in localStorage, so the count only exists after hydration.
  // Rendering it on the server would mismatch and blank the whole bar.
  useEffect(() => setMounted(true), []);

  // The dashboard is a working surface, not a storefront — the tab bar just
  // gets in the way there.
  if (pathname?.startsWith('/dashboard') || pathname === '/login') return null;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-stone-800"
      // Keeps the bar clear of the iPhone home indicator.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          const count = mounted && item.href === '/cart' ? items.length : 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                // min-h-14 keeps every target above the ~44px minimum a thumb
                // can reliably hit.
                className={`relative flex flex-col items-center justify-center gap-1 min-h-14 py-2 text-[11px] font-medium transition-colors touch-manipulation focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500 outline-none ${
                  active ? 'text-orange-400' : 'text-stone-500 hover:text-stone-300'
                }`}
              >
                <span className="relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 flex items-center justify-center bg-orange-600 text-white text-[10px] font-bold rounded-full tabular-nums">
                      {count}
                    </span>
                  )}
                </span>
                {item.label}
                {active && <span className="absolute top-0 inset-x-6 h-0.5 bg-orange-500 rounded-full" aria-hidden="true" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
