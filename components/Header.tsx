'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCartStore } from '@/stores/useCartStore';
import { NavDrawer } from '@/components/NavDrawer';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, user, initAuth } = useAuthStore();
  // Rehydrate the Supabase session on every page load. Without this the
  // store only ever knows you're logged in during the same JS session you
  // typed the password in — one refresh and the app thinks you're a guest.
  useEffect(() => { initAuth(); }, [initAuth]);
  const { items } = useCartStore();

  const navLinks = [
    { href: '/beats', label: 'Beats' },
    { href: '/blog', label: 'Blog' },
    { href: '/store', label: 'Store' },
    { href: '/art-museum', label: 'Art Museum' },
    { href: '/about', label: 'About' },
  ];

  // The drawer groups the same destinations and says what each one is. The
  // bottom tab bar only carries four; everything else was previously
  // reachable only by opening a menu and reading a flat list of labels.
  const drawerGroups = [
    {
      heading: 'Browse',
      items: [
        { href: '/beats', label: 'Beats', hint: 'Instrumentals to license' },
        { href: '/store', label: 'Store', hint: 'Singles & albums to buy' },
        { href: '/blog', label: 'Reviews', hint: 'Album reviews, scored /10' },
        { href: '/art-museum', label: 'Art Museum', hint: 'Coming soon' },
      ],
    },
    {
      heading: 'Your stuff',
      items: [
        { href: '/cart', label: items.length > 0 ? `Cart (${items.length})` : 'Cart', hint: 'Checkout with M-Pesa or card' },
        ...(isLoggedIn ? [{ href: '/dashboard', label: 'Dashboard', hint: 'Upload and manage your catalogue' }] : []),
      ],
    },
    {
      heading: 'About',
      items: [{ href: '/about', label: 'About JST.BEAT', hint: 'Who makes these beats' }],
    },
  ];

  return (
    <>
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      // Surface-1 over the page's surface-0: the header reads as a layer above
      // the content rather than a black band merging into it.
      style={{ backgroundColor: 'rgb(18 17 16 / 0.82)', borderColor: 'var(--line)' }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tighter text-white hover:text-orange-400 transition-colors duration-[var(--dur-1)] focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none">
          JST<span className="text-orange-500">.</span>BEAT
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors duration-[var(--dur-1)] hover:text-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
              style={{ color: 'var(--text-2)' }}
            >
              {link.label}
            </Link>
          ))}
          
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="text-sm font-medium text-orange-400 hover:text-orange-300 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            >
              Dashboard
            </Link>
          )}

          {/* Cart */}
          <Link
            href="/cart"
            className="relative text-sm font-medium transition-colors duration-[var(--dur-1)] hover:text-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
            style={{ color: 'var(--text-2)' }}
          >
            Cart
            {items.length > 0 && (
              <span className="absolute -top-2 -right-3 w-5 h-5 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {items.length}
              </span>
            )}
          </Link>

          {/* Auth */}
          {!isLoggedIn ? (
            <Link
              href="/login"
              className="text-sm font-bold bg-orange-600 text-white px-4 py-2 rounded-full hover:bg-orange-500 transition-colors duration-[var(--dur-1)] motion-press focus-visible:ring-2 focus-visible:ring-orange-400 outline-none"
            >
              Login
            </Link>
          ) : (
            <span className="text-xs text-stone-500 truncate max-w-[100px]">
              {user?.email?.split('@')[0]}
            </span>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-stone-400 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

    </header>

    {/* Slides in over the page instead of pushing it down, so the storefront
        stays put while you look for where to go. */}
    <NavDrawer
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      groups={drawerGroups}
      footer={
        !isLoggedIn ? (
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="block w-full text-center bg-orange-600 text-white font-bold py-3 rounded-xl hover:bg-orange-500 transition"
          >
            Producer login
          </Link>
        ) : (
          <p className="text-xs text-stone-500 truncate">Signed in as {user?.email}</p>
        )
      }
    />
    </>
  );
}
