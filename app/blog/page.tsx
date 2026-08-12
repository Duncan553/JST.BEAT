'use client';

import Link from 'next/link';

export default function BlogPage() {
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
          JST<span className="text-orange-500">.</span>BLOG
        </h1>
        <p className="text-stone-500 text-lg mb-8">Music thoughts, album reviews, and behind the scenes.</p>
        
        <div className="inline-flex items-center gap-3 px-8 py-4 bg-orange-950/30 border border-orange-900/30 rounded-full">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
          </span>
          <span className="text-orange-400 font-bold tracking-wide">COMING SOON</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 space-y-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="border border-stone-800 rounded-xl p-6 bg-stone-900/30 opacity-40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-stone-800 rounded-full" />
              <div>
                <div className="w-40 h-4 bg-stone-800 rounded mb-2" />
                <div className="w-24 h-3 bg-stone-800 rounded" />
              </div>
            </div>
            <div className="w-full h-48 bg-stone-800 rounded-lg mb-4" />
            <div className="w-3/4 h-4 bg-stone-800 rounded mb-2" />
            <div className="w-1/2 h-4 bg-stone-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
