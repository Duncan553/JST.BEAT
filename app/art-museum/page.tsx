'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ArtMuseumPage() {
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-orange-50 mb-4">
          ART<span className="text-orange-500">.</span>MUSEUM
        </h1>
        <p className="text-stone-500 text-lg mb-8">A space for visual artists to showcase their work.</p>
        
        <div className="inline-flex items-center gap-3 px-8 py-4 bg-orange-950/30 border border-orange-900/30 rounded-full mb-8">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <span className="text-orange-400 font-bold tracking-wide">COMING SOON</span>
        </div>

        <div className="max-w-md mx-auto">
          <button
            onClick={() => setShowRegister(!showRegister)}
            className="w-full bg-stone-900 border border-stone-700 text-stone-300 py-3 rounded-xl font-bold hover:border-orange-500 hover:text-orange-300 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
          >
            {showRegister ? 'Hide Registration' : 'Artist Registration (Preview)'}
          </button>

          {showRegister && (
            <div className="mt-4 p-6 border border-stone-800 rounded-xl bg-stone-900/40 text-left space-y-4">
              <h3 className="text-lg font-bold text-orange-50">Join the Museum</h3>
              <p className="text-sm text-stone-500">Create an artist profile to showcase your work.</p>
              
              <div>
                <label className="block text-sm text-stone-400 mb-1">Artist Name</label>
                <input disabled placeholder="Your artist name" className="w-full bg-black border border-stone-800 rounded-lg px-3 py-2 text-stone-600 placeholder-stone-700 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Email</label>
                <input disabled placeholder="artist@email.com" className="w-full bg-black border border-stone-800 rounded-lg px-3 py-2 text-stone-600 placeholder-stone-700 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm text-stone-400 mb-1">Portfolio Link</label>
                <input disabled placeholder="https://your-portfolio.com" className="w-full bg-black border border-stone-800 rounded-lg px-3 py-2 text-stone-600 placeholder-stone-700 cursor-not-allowed" />
              </div>
              <button disabled className="w-full bg-stone-800 text-stone-600 py-3 rounded-lg font-bold cursor-not-allowed">
                Register (Coming Soon)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div key={n} className="border border-stone-800 rounded-xl overflow-hidden bg-stone-900/30 opacity-40">
            <div className="aspect-square bg-stone-800" />
            <div className="p-3">
              <div className="w-3/4 h-3 bg-stone-800 rounded mb-1" />
              <div className="w-1/2 h-3 bg-stone-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
