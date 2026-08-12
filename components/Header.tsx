'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCartStore } from '@/stores/useCartStore';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, user } = useAuthStore();
  const { items } = useCartStore();

  const navLinks = [
    { href: '/beats', label: 'Beats' },
    { href: '/blog', label: 'Blog' },
    { href: '/store', label: 'Store' },
    { href: '/art-museum', label: 'Art Museum' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-stone-800/50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-black tracking-tighter text-white hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none">
          JST<span className="text-orange-500">.</span>BEAT
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-stone-400 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
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
            className="relative text-sm font-medium text-stone-400 hover:text-orange-400 transition focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
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
              className="text-sm font-bold bg-orange-600 text-white px-4 py-2 rounded-full hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-400 outline-none"
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

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-stone-800 bg-black/95 px-6 py-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block text-stone-400 hover:text-orange-400 transition py-1"
            >
              {link.label}
            </Link>
          ))}
          {isLoggedIn && (
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="block text-orange-400 hover:text-orange-300 transition py-1"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/cart"
            onClick={() => setMenuOpen(false)}
            className="block text-stone-400 hover:text-orange-400 transition py-1"
          >
            Cart {items.length > 0 && `(${items.length})`}
          </Link>
          {!isLoggedIn && (
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block text-orange-400 font-bold py-1"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
