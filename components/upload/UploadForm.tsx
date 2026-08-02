'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export function UploadForm() {
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
      // Upload audio
      const audioPath = `beats/${Date.now()}-${audioFile.name}`;
      const { error: audioError } = await supabase.storage.from('beats').upload(audioPath, audioFile);
      if (audioError) throw audioError;

      // Upload cover
      const coverPath = `covers/${Date.now()}-${coverFile.name}`;
      const { error: coverError } = await supabase.storage.from('beats').upload(coverPath, coverFile);
      if (coverError) throw coverError;

      // Get public URLs
      const { data: audioUrl } = supabase.storage.from('beats').getPublicUrl(audioPath);
      const { data: coverUrl } = supabase.storage.from('beats').getPublicUrl(coverPath);

      // DEBUG: Check what URLs look like
      console.log('Audio URL object:', audioUrl);
      console.log('Cover URL object:', coverUrl);
      console.log('Audio publicUrl:', audioUrl?.publicUrl);
      console.log('Cover publicUrl:', coverUrl?.publicUrl);

      // Build data safely
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

      console.log('Sending to Supabase:', JSON.stringify(beatData, null, 2));

      const { error: dbError } = await supabase.from('beats').insert(beatData);

      if (dbError) {
        console.error('Supabase error:', dbError);
        throw dbError;
      }

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
    <div className="bg-white border rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Upload New Beat</h3>
      {message && (
        <div className={`p-3 rounded mb-4 ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">BPM</label>
            <input type="number" value={bpm} onChange={(e) => setBpm(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Key</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Genre</label>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">MP3 Price (KSh)</label>
            <input type="number" step="0.01" value={priceMp3} onChange={(e) => setPriceMp3(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WAV Price (KSh)</label>
            <input type="number" step="0.01" value={priceWav} onChange={(e) => setPriceWav(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Stems Price (KSh)</label>
            <input type="number" step="0.01" value={priceStems} onChange={(e) => setPriceStems(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="trap, dark, melodic" className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Audio File (MP3/WAV)</label>
          <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} className="w-full" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cover Art (JPG/PNG)</label>
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="w-full" required />
        </div>
        <button type="submit" disabled={uploading} className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:bg-gray-400">
          {uploading ? 'Uploading...' : 'Upload Beat'}
        </button>
      </form>
    </div>
  );
}