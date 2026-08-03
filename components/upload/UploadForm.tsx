'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useBeatsStore } from '@/stores/useBeatsStore';

export function UploadForm() {
  const { addBeat } = useBeatsStore();
  const [title, setTitle] = useState('');
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  const [genre, setGenre] = useState('');
  const [priceMp3, setPriceMp3] = useState('');
  const [priceWav, setPriceWav] = useState('');
  const [priceStems, setPriceStems] = useState('');
  const [tags, setTags] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !coverFile) {
      setMessage('Please select both audio and cover art files');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const audioPath = `beats/${Date.now()}-${audioFile.name}`;
      const { error: audioError } = await supabase.storage.from('beats').upload(audioPath, audioFile);
      if (audioError) throw audioError;

      const coverPath = `covers/${Date.now()}-${coverFile.name}`;
      const { error: coverError } = await supabase.storage.from('beats').upload(coverPath, coverFile);
      if (coverError) throw coverError;

      const { data: audioUrl } = supabase.storage.from('beats').getPublicUrl(audioPath);
      const { data: coverUrl } = supabase.storage.from('beats').getPublicUrl(coverPath);

      const beatData = {
        title: title.trim(),
        bpm: parseInt(bpm) || 0,
        key: key.trim(),
        genre: genre.trim(),
        cover_art: coverUrl.publicUrl,
        snippet_url: audioUrl.publicUrl,
        full_url: audioUrl.publicUrl,
        price_mp3: parseFloat(priceMp3) || 0,
        price_wav: parseFloat(priceWav) || 0,
        price_stems: parseFloat(priceStems) || 0,
        tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(t => t.length > 0) : [],
      };

      const { data: inserted, error: dbError } = await supabase.from('beats').insert(beatData).select().single();

      if (dbError) {
        console.error('Supabase error:', dbError);
        throw dbError;
      }

      // Add to global store so home page sees it immediately
      if (inserted) addBeat(inserted);

      setMessage('Beat uploaded successfully!');
      setTitle(''); setBpm(''); setKey(''); setGenre('');
      setPriceMp3(''); setPriceWav(''); setPriceStems('');
      setTags(''); setAudioFile(null); setCoverFile(null);
    } catch (err: any) {
      console.error('Full error:', err);
      setMessage(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-stone-900/50 border border-stone-800 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-white">Upload New Beat</h3>
      {message && (
        <div className={`p-3 rounded mb-4 ${message.includes('Error') ? 'bg-red-950/40 border border-red-900/30 text-red-400' : 'bg-green-950/40 border border-green-900/30 text-green-400'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Title</label>
          <input 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
            required 
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">BPM</label>
            <input 
              type="number" 
              value={bpm} 
              onChange={(e) => setBpm(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Key</label>
            <input 
              value={key} 
              onChange={(e) => setKey(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Genre</label>
            <input 
              value={genre} 
              onChange={(e) => setGenre(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">MP3 Price (KSh)</label>
            <input 
              type="number" 
              step="0.01" 
              value={priceMp3} 
              onChange={(e) => setPriceMp3(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">WAV Price (KSh)</label>
            <input 
              type="number" 
              step="0.01" 
              value={priceWav} 
              onChange={(e) => setPriceWav(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Stems Price (KSh)</label>
            <input 
              type="number" 
              step="0.01" 
              value={priceStems} 
              onChange={(e) => setPriceStems(e.target.value)} 
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
              required 
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Tags (comma separated)</label>
          <input 
            value={tags} 
            onChange={(e) => setTags(e.target.value)} 
            placeholder="trap, dark, melodic" 
            className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Audio File (MP3/WAV)</label>
          <input 
            type="file" 
            accept="audio/*" 
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)} 
            className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500" 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Cover Art (JPG/PNG)</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)} 
            className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500" 
            required 
          />
        </div>
        <button 
          type="submit" 
          disabled={uploading} 
          className="w-full bg-orange-600 text-white py-3 rounded-full font-bold hover:bg-orange-500 disabled:bg-stone-700 transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
        >
          {uploading ? 'Uploading...' : 'Upload Beat'}
        </button>
      </form>
    </div>
  );
}