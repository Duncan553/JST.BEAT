import { supabase } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
import { Beat } from '@/types/beat';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// Prevent static generation issues — render on-demand
export const dynamic = 'force-dynamic';

export default async function BeatPage({ params }: { params: { id: string } }) {
  const { data: beat, error } = await supabase
    .from('beats')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !beat) notFound();

  const b = beat as Beat;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link 
          href="/" 
          className="text-sm text-stone-500 hover:text-orange-400 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none"
        >
          ← Back to beats
        </Link>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center text-white text-2xl font-bold border border-stone-800">
          {b.cover_art ? (
            <img src={b.cover_art} alt={`${b.title} cover art`} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="truncate px-4">{b.title}</span>
          )}
        </div>
        <div>
          <h1 
            className="text-4xl font-bold mb-2"
            style={{ textWrap: 'balance' }}
          >
            {b.title}
          </h1>
          <div className="flex gap-3 text-gray-500 mb-4 flex-wrap">
            <span className="tabular-nums">{b.bpm} BPM</span>
            <span aria-hidden="true">·</span>
            <span>{b.key}</span>
            <span aria-hidden="true">·</span>
            <span>{b.genre}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {b.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-sm truncate max-w-[150px]" title={tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between p-4 border rounded-lg hover:border-orange-500/30 transition-colors">
              <span>MP3 Lease</span>
              <span className="font-bold text-xl tabular-nums">KSh {b.price_mp3}</span>
            </div>
            <div className="flex justify-between p-4 border rounded-lg hover:border-orange-500/30 transition-colors">
              <span>WAV Lease</span>
              <span className="font-bold text-xl tabular-nums">KSh {b.price_wav}</span>
            </div>
            <div className="flex justify-between p-4 border rounded-lg hover:border-orange-500/30 transition-colors">
              <span>Trackout/Stems</span>
              <span className="font-bold text-xl tabular-nums">KSh {b.price_stems}</span>
            </div>
          </div>

          <Link
            href="/cart"
            className="mt-6 inline-block w-full text-center bg-orange-600 text-white py-3 rounded-full font-bold hover:bg-orange-500 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black outline-none touch-manipulation"
          >
            Add to Cart
          </Link>
        </div>
      </div>
    </div>
  );
}