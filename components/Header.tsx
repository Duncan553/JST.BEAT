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
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur border-b border-orange-900/30 px-6 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tighter text-orange-100">JST.BEAT</Link>
        <div className="flex gap-6 text-sm font-medium">
          <span className="text-stone-500">Beats</span>
          <span className="text-stone-500">Cart</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur border-b border-orange-900/30 px-6 py-4 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold tracking-tighter text-orange-100 hover:text-orange-300 transition">
        JST.BEAT
      </Link>

      <nav className="flex gap-6 text-sm font-medium items-center">
        <Link href="/" className="text-stone-400 hover:text-orange-200 transition">Beats</Link>
        <Link href="/about" className="text-stone-400 hover:text-orange-200 transition">About</Link>
        <Link href="/contact" className="text-stone-400 hover:text-orange-200 transition">Contact</Link>
        <Link href="/cart" className="text-stone-400 hover:text-orange-200 transition">
          Cart{count > 0 ? ` (${count})` : ''}
        </Link>
        
        {isLoggedIn ? (
          <>
            <Link href="/dashboard" className="text-stone-400 hover:text-orange-200 transition">Dashboard</Link>
            <button onClick={logout} className="text-orange-400 hover:text-orange-300 transition text-sm">Logout</button>
          </>
        ) : (
          <Link href="/login" className="text-stone-400 hover:text-orange-200 transition">Login</Link>
        )}
      </nav>
    </header>
  );
}
