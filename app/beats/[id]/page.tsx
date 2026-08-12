'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';
import Link from 'next/link';
import { useCartStore } from '@/stores/useCartStore';
import { usePlayerStore } from '@/stores/usePlayerStore';

function BigVinyl({ cover, isPlaying }: { cover: string; isPlaying: boolean }) {
  const vinylRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const vinyl = vinylRef.current;
    if (!vinyl) return;

    if (isPlaying) {
      let lastTime = performance.now();
      
      const rotate = (time: number) => {
        const delta = time - lastTime;
        lastTime = time;
        rotationRef.current += (delta / 1000) * 120; // 120 deg per second (3s per rotation)
        vinyl.style.transform = `rotate(${rotationRef.current}deg)`;
        rafRef.current = requestAnimationFrame(rotate);
      };
      
      rafRef.current = requestAnimationFrame(rotate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  return (
    <div 
      ref={vinylRef}
      className="relative w-64 h-64 md:w-80 md:h-80 mx-auto"
      style={{ willChange: 'transform' }}
    >
      <div className="absolute -inset-6 bg-orange-600/10 rounded-full blur-3xl" />
      <div className="relative w-full h-full rounded-full overflow-hidden border-[3px] border-stone-800 shadow-2xl shadow-black/80">
        <img 
          src={cover || '/images/hero-studio.jpg'} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-[6px] rounded-full border border-white/5" />
        <div className="absolute inset-[12px] rounded-full border border-white/5" />
        <div className="absolute inset-[18px] rounded-full border border-white/5" />
        <div className="absolute inset-[24px] rounded-full border border-white/5" />
        <div className="absolute inset-[30px] rounded-full border border-white/5" />
        <div className="absolute inset-[36px] rounded-full border border-white/5" />
        <div className="absolute inset-[42px] rounded-full border border-white/5" />
        <div className="absolute inset-[48px] rounded-full border border-white/5" />
        <div className="absolute inset-[54px] rounded-full border border-white/5" />
        <div className="absolute inset-[60px] rounded-full border border-white/5" />
        <div className="absolute inset-[30%] rounded-full bg-black/90 border border-stone-700/40 flex items-center justify-center">
          <div className="w-4 h-4 bg-stone-900 rounded-full border-2 border-stone-600" />
        </div>
        <div className="absolute top-6 left-10 w-8 h-16 bg-white/10 rounded-full rotate-45 blur-[2px]" />
        <div className="absolute bottom-10 right-12 w-6 h-12 bg-white/5 rounded-full -rotate-12 blur-[1px]" />
      </div>
    </div>
  );
}

export default function BeatPage() {
  const params = useParams();
  const id = params.id as string;
  const [beat, setBeat] = useState<Beat | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLicense, setSelectedLicense] = useState<'wav' | 'stems'>('wav');
  const [added, setAdded] = useState(false);
  const { addItem, isInCart } = useCartStore();
  const { currentBeatId, isPlaying, play, pause } = usePlayerStore();

  useEffect(() => {
    async function fetchBeat() {
      const { data, error } = await supabase
        .from('beats')
        .select('id, title, bpm, key, genre, cover_art, snippet_url, price_mp3, price_wav, price_stems, stems_url, tags, created_at')
        .eq('id', id)
        .single();

      if (error || !data) setBeat(null);
      else setBeat(data as Beat);
      setLoading(false);
    }
    fetchBeat();
  }, [id]);

  useEffect(() => {
    if (beat) setAdded(isInCart(beat.id));
  }, [beat, isInCart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-orange-600/30 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!beat) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <h1 className="text-6xl font-black text-stone-800">404</h1>
        <p className="text-xl text-stone-500">This beat doesn&apos;t exist.</p>
        <Link href="/" className="text-orange-500 hover:text-orange-400 underline">← Back to beats</Link>
      </div>
    );
  }

  const isThisPlaying = currentBeatId === beat.id && isPlaying;
  const hasStems = beat.price_stems > 0 && !!beat.stems_url;
  const currentPrice = selectedLicense === 'stems' && hasStems ? beat.price_stems : beat.price_wav;

  const handlePlay = () => {
    if (isThisPlaying) pause();
    else play(beat.id, beat.snippet_url, beat.title, beat.cover_art);
  };

  const handleAddToCart = () => {
    if (added) return;
    addItem(beat, selectedLicense);
    setAdded(true);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to beats
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <BigVinyl cover={beat.cover_art} isPlaying={isThisPlaying} />
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mt-10 mb-3">
          {beat.title}
        </h1>
        
        <div className="flex items-center justify-center gap-3 text-stone-400 text-sm mb-8">
          <span className="tabular-nums font-mono">{beat.bpm} BPM</span>
          <span className="w-1 h-1 bg-stone-600 rounded-full" />
          <span>{beat.key}</span>
          <span className="w-1 h-1 bg-stone-600 rounded-full" />
          <span>{beat.genre}</span>
        </div>

        <button
          onClick={handlePlay}
          className="inline-flex items-center gap-3 px-8 py-4 bg-orange-600 text-white rounded-full font-bold text-lg hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation"
        >
          {isThisPlaying ? (
            <>
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1.5" />
                <rect x="14" y="4" width="4" height="16" rx="1.5" />
              </svg>
              Pause Preview
            </>
          ) : (
            <>
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Preview
            </>
          )}
        </button>

        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {beat.tags.map((tag) => (
            <span key={tag} className="px-4 py-1.5 bg-stone-900 border border-stone-800 rounded-full text-sm text-stone-400">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto px-6">
        <h3 className="text-sm font-bold text-stone-500 uppercase tracking-widest mb-4 text-center">Choose License</h3>
        
        <div className="space-y-3">
          <button
            onClick={() => setSelectedLicense('wav')}
            className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
              selectedLicense === 'wav'
                ? 'border-orange-500 bg-orange-950/20 shadow-lg shadow-orange-900/10'
                : 'border-stone-800 bg-stone-900/40 hover:border-stone-600'
            }`}
          >
            <div className="text-left">
              <p className="font-bold text-lg">WAV Lease</p>
              <p className="text-sm text-stone-500">High quality, ready for release</p>
            </div>
            <span className="text-2xl font-black text-orange-400 tabular-nums">KSh {beat.price_wav}</span>
          </button>

          {hasStems ? (
            <button
              onClick={() => setSelectedLicense('stems')}
              className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                selectedLicense === 'stems'
                  ? 'border-orange-500 bg-orange-950/20 shadow-lg shadow-orange-900/10'
                  : 'border-stone-800 bg-stone-900/40 hover:border-stone-600'
              }`}
            >
              <div className="text-left">
                <p className="font-bold text-lg">Trackout / Stems</p>
                <p className="text-sm text-stone-500">Individual tracks in ZIP file</p>
              </div>
              <span className="text-2xl font-black text-orange-400 tabular-nums">KSh {beat.price_stems}</span>
            </button>
          ) : (
            <div className="w-full flex items-center justify-between p-5 rounded-2xl border-2 border-stone-900 bg-stone-950/30 opacity-50 cursor-not-allowed">
              <div className="text-left">
                <p className="font-bold text-lg text-stone-600">Trackout / Stems</p>
                <p className="text-sm text-stone-700">Not available for this beat</p>
              </div>
              <span className="text-2xl font-black text-stone-700 tabular-nums">—</span>
            </div>
          )}
        </div>

        <div className="mt-8">
          {added ? (
            <Link href="/cart" className="block w-full text-center bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-500 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-900/20">
              🛒 In Cart — Go to Checkout
            </Link>
          ) : (
            <button
              onClick={handleAddToCart}
              className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-orange-500 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-900/20 focus-visible:ring-2 focus-visible:ring-orange-400 outline-none touch-manipulation"
            >
              Add {selectedLicense.toUpperCase()} to Cart — KSh {currentPrice}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
