'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';
import { BeatCard } from '@/components/beat-card/BeatCard';
import Link from 'next/link';

export default function HomePage() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBeats = async () => {
      const { data, error } = await supabase
        .from('beats')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) console.error('Fetch error:', error);
      setBeats(data || []);
      setLoading(false);
    };

    fetchBeats();
  }, []);

  return (
    <div className="space-y-0">
      {/* HERO — Black with warm accent image */}
      <section className="relative bg-black text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 z-10">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
              JST<span className="text-orange-500">.</span>BEAT
            </h1>
            <p className="text-xl text-stone-400 max-w-md leading-relaxed">
              Premium beats for artists and producers. 
              Buy exclusive WAV leases and make your next hit.
            </p>
            <div className="flex gap-4">
              <Link 
                href="/#beats" 
                className="group relative px-8 py-3 bg-orange-600 text-white font-bold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <span className="relative z-10">Browse Beats</span>
                <span className="absolute inset-0 bg-orange-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </Link>
              <Link 
                href="/about" 
                className="px-8 py-3 border border-stone-700 text-stone-300 font-bold rounded-full hover:border-orange-500 hover:text-orange-300 transition-all hover:scale-105 active:scale-95"
              >
                About Me
              </Link>
            </div>
          </div>
          
          {/* Replace src with your Pinterest image path */}
          <div className="flex-1 relative">
            <div className="relative rounded-2xl overflow-hidden border border-stone-800 rotate-2 hover:rotate-0 transition-transform duration-500">
              <img 
                src="/your-keyboard-image.jpg" 
                alt="Studio gear" 
                className="w-full h-auto object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.classList.add('bg-stone-900', 'flex', 'items-center', 'justify-center', 'aspect-square');
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class=text-6xl>🎹</span>';
                }}
              />
            </div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-orange-600 rounded-full blur-3xl opacity-40" />
          </div>
        </div>
      </section>

      {/* EDITORIAL SECTION 1 — Warm rust background like Pinterest */}
      <section className="bg-orange-700 text-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="rounded-2xl overflow-hidden shadow-2xl rotate-[-1deg] hover:rotate-0 transition-transform duration-500 border-4 border-orange-800">
              <img 
                src="/your-hands-on-keys-image.jpg" 
                alt="Making beats" 
                className="w-full h-auto object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.classList.add('bg-orange-900', 'flex', 'items-center', 'justify-center', 'aspect-video');
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class=text-6xl>🎛️</span>';
                }}
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif italic tracking-tight">
              Find what's on<br />your mind.
            </h2>
            <p className="text-orange-100 leading-relaxed max-w-md">
              Every beat starts with a feeling. Dig through the catalog and find the one 
              that matches your vision — from dark trap to melodic afro.
            </p>
            <Link 
              href="/#beats" 
              className="inline-block px-6 py-2 border border-white/30 rounded-full text-sm font-medium hover:bg-white hover:text-orange-700 transition-all"
            >
              Explore Sounds →
            </Link>
          </div>
        </div>
      </section>

      {/* EDITORIAL SECTION 2 — Black with image */}
      <section className="bg-black text-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
          <div className="flex-1">
            <div className="rounded-2xl overflow-hidden border border-stone-800 hover:border-orange-900/50 transition-colors duration-500">
              <img 
                src="/your-gear-image.jpg" 
                alt="Studio setup" 
                className="w-full h-auto object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.classList.add('bg-stone-900', 'flex', 'items-center', 'justify-center', 'aspect-video');
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class=text-6xl>🎚️</span>';
                }}
              />
            </div>
          </div>
          <div className="flex-1 space-y-6">
            <h2 className="text-4xl md:text-5xl font-serif italic tracking-tight text-orange-50">
              Easily play an<br />
              <span className="text-orange-500">F# minor Jazz.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed max-w-md">
              All beats are mixed and mastered ready for your vocals. 
              Just add your voice and release. No extra engineering needed.
            </p>
            <Link 
              href="/contact" 
              className="inline-block px-6 py-2 bg-orange-600 rounded-full text-sm font-bold hover:bg-orange-500 transition-all hover:scale-105 active:scale-95"
            >
              Custom Orders
            </Link>
          </div>
        </div>
      </section>

      {/* BEATS GRID — Black background */}
      <section id="beats" className="bg-black py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-orange-50">Fresh Drops</h2>
            <p className="text-stone-500 mt-2">Latest beats added to the store</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="border border-stone-800 rounded-xl p-4 animate-pulse bg-stone-900">
                  <div className="aspect-square bg-stone-800 rounded-lg mb-4" />
                  <div className="h-4 bg-stone-800 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-stone-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : beats.length === 0 ? (
            <div className="text-center py-20 border border-stone-800 rounded-xl bg-stone-900/30">
              <p className="text-stone-500 text-lg">No beats available yet.</p>
              <p className="text-stone-600 text-sm mt-2">Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {beats.map((beat) => (
                <BeatCard key={beat.id} beat={beat} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="bg-orange-700 text-white py-20 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Want Custom Beats?</h2>
        <p className="text-orange-100 mb-8 max-w-md mx-auto">
          I also take custom orders. Hit me up and let's cook something unique.
        </p>
        <Link 
          href="/contact" 
          className="inline-block bg-white text-orange-700 px-8 py-3 rounded-full font-bold hover:bg-orange-100 transition-all hover:scale-105 active:scale-95"
        >
          Get In Touch
        </Link>
      </section>
    </div>
  );
}
