'use client';

import { useState } from 'react';
import { useBeatsStore } from '@/stores/useBeatsStore';

export function UploadForm() {
  const { addBeat } = useBeatsStore();
  const [title, setTitle] = useState('');
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState('');
  const [genre, setGenre] = useState('');
  const [priceWav, setPriceWav] = useState('');
  const [priceStems, setPriceStems] = useState('');
  const [tags, setTags] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [stemsFile, setStemsFile] = useState<File | null>(null);
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
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('bpm', bpm);
      formData.append('key', key.trim());
      formData.append('genre', genre.trim());
      formData.append('price_wav', priceWav);
      formData.append('price_stems', priceStems || '0');
      formData.append('tags', tags.trim());
      formData.append('audio', audioFile);
      formData.append('cover', coverFile);
      if (stemsFile) {
        formData.append('stems', stemsFile);
      }

      const res = await fetch('/api/beats/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Add to global store so home page sees it immediately
      if (data.beat) addBeat(data.beat);

      setMessage('Beat uploaded successfully!');
      setTitle(''); setBpm(''); setKey(''); setGenre('');
      setPriceWav(''); setPriceStems(''); setTags('');
      setAudioFile(null); setCoverFile(null); setStemsFile(null);
      
      // Reset file inputs
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input) => {
        (input as HTMLInputElement).value = '';
      });
    } catch (err: any) {
      console.error('Upload error:', err);
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">WAV Price (KSh) <span className="text-red-500">*</span></label>
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
            <label className="block text-sm font-medium mb-1 text-stone-300">Stems Price (KSh) <span className="text-stone-500 text-xs">(optional)</span></label>
            <input 
              type="number" 
              step="0.01" 
              value={priceStems} 
              onChange={(e) => setPriceStems(e.target.value)} 
              placeholder="0 = no stems"
              className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors" 
            />
            <p className="text-xs text-stone-600 mt-1">Leave empty or 0 if no stems</p>
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
          <label className="block text-sm font-medium mb-1 text-stone-300">Audio File (MP3/WAV, max 20MB) <span className="text-red-500">*</span></label>
          <input 
            type="file" 
            accept="audio/*" 
            onChange={(e) => setAudioFile(e.target.files?.[0] || null)} 
            className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500" 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Cover Art (JPG/PNG, max 5MB) <span className="text-red-500">*</span></label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)} 
            className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500" 
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Stems ZIP (optional, max 50MB)</label>
          <input 
            type="file" 
            accept=".zip,application/zip,application/x-zip-compressed" 
            onChange={(e) => setStemsFile(e.target.files?.[0] || null)} 
            className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-stone-700 file:text-white file:font-bold hover:file:bg-stone-600" 
          />
          <p className="text-xs text-stone-600 mt-1">ZIP file with individual track stems. Only needed if selling stems.</p>
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
