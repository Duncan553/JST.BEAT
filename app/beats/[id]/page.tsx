import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';
import { notFound } from 'next/navigation';

export default async function BeatPage({ params }: { params: { id: string } }) {
  const { data: beat, error } = await supabase
    .from('beats')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !beat) notFound();

  const b = beat as Beat;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-900 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
          {b.title}
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">{b.title}</h1>
          <div className="flex gap-3 text-gray-500 mb-4">
            <span>{b.bpm} BPM</span><span>•</span><span>{b.key}</span><span>•</span><span>{b.genre}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-6">
            {b.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{tag}</span>
            ))}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between p-4 border rounded-lg"><span>MP3 Lease</span><span className="font-bold text-xl">${b.price_mp3}</span></div>
            <div className="flex justify-between p-4 border rounded-lg"><span>WAV Lease</span><span className="font-bold text-xl">${b.price_wav}</span></div>
            <div className="flex justify-between p-4 border rounded-lg"><span>Trackout/Stems</span><span className="font-bold text-xl">${b.price_stems}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
