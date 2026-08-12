'use client';

import Link from 'next/link';
import { useCartStore } from '@/stores/useCartStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState, useEffect } from 'react';

export function Header() {
  const { items } = useCartStore();
  const { isLoggedIn, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const count = items.length;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tighter text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none">
            JST<span className="text-orange-500">.</span>BEAT
          </Link>
          <nav className="flex items-center gap-6">
            <span className="text-stone-500">Beats</span>
            <span className="text-stone-500">Cart</span>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-stone-800">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link 
          href="/" 
          className="text-xl font-black tracking-tighter text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-transform hover:scale-105"
        >
          JST<span className="text-orange-500">.</span>BEAT
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link 
            href="/" 
            className="text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors"
          >
            Beats
          </Link>
          <Link 
            href="/about" 
            className="text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors"
          >
            About
          </Link>
          <Link 
            href="/contact" 
            className="text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors"
          >
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link 
            href="/cart" 
            aria-label={`Cart${count > 0 ? `, ${count} item${count !== 1 ? 's' : ''}` : ''}`}
            className="relative text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors px-3 py-2"
          >
            Cart
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link 
                href="/dashboard" 
                className="text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors px-3 py-2"
              >
                Dashboard
              </Link>
              <button 
                onClick={logout}
                className="text-sm font-medium text-stone-400 hover:text-red-400 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors px-3 py-2 touch-manipulation"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="text-sm font-medium text-stone-300 hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg outline-none transition-colors px-3 py-2"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}