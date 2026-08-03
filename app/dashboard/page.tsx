'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { UploadForm } from '@/components/upload/UploadForm';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';

export default function DashboardPage() {
  const { isLoggedIn, logout } = useAuthStore();
  const { beats, loading, fetchBeats, updateBeat, removeBeat } = useBeatsStore();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState({ price_wav: '' });
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isLoggedIn) {
      router.replace('/login');
      return;
    }
    fetchBeats();
  }, [isLoggedIn, mounted, router, fetchBeats]);

  const handleDelete = async (beat: Beat) => {
    if (!window.confirm(`Delete "${beat.title}"? This cannot be undone.`)) return;

    const { error: dbError } = await supabase.from('beats').delete().eq('id', beat.id);
    
    if (dbError) {
      console.error('Delete failed:', dbError);
      setMessage(`Error: ${dbError.message}`);
      return;
    }

    try {
      if (beat.snippet_url) {
        const parts = beat.snippet_url.split('/beats/');
        if (parts[1]) await supabase.storage.from('beats').remove([`beats/${parts[1]}`]);
      }
      if (beat.cover_art) {
        const parts = beat.cover_art.split('/covers/');
        if (parts[1]) await supabase.storage.from('beats').remove([`covers/${parts[1]}`]);
      }
    } catch (e) {
      // Ignore storage errors
    }

    removeBeat(beat.id);
    setMessage('Deleted successfully');
    setTimeout(() => setMessage(''), 2000);
  };

  const startEdit = (beat: Beat) => {
    setEditing(beat.id);
    setEditPrices({ price_wav: beat.price_wav.toString() });
  };

  const saveEdit = async (beatId: string) => {
    const newPrice = parseFloat(editPrices.price_wav);
    const { error } = await supabase.from('beats').update({ price_wav: newPrice }).eq('id', beatId);

    if (!error) {
      updateBeat(beatId, { price_wav: newPrice });
      setEditing(null);
      setMessage('Updated successfully');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(`Error: ${error.message}`);
    }
  };

  if (!mounted || !isLoggedIn) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-black text-white min-h-screen">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 bg-black text-white min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Producer Dashboard</h1>
        <button 
          onClick={logout} 
          className="text-sm text-red-400 hover:text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation"
        >
          Logout
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded mb-4 ${message.includes('Error') ? 'bg-red-950/40 border border-red-900/30 text-red-400' : 'bg-green-950/40 border border-green-900/30 text-green-400'}`}>
          {message}
        </div>
      )}

      <UploadForm />

      <div>
        <h2 className="text-xl font-bold mb-4 text-orange-50">Your Beats ({beats.length})</h2>
        {loading ? (
          <p className="text-stone-500">Loading beats...</p>
        ) : beats.length === 0 ? (
          <p className="text-stone-500">No beats uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {beats.map((beat) => (
              <div key={beat.id} className="border border-stone-800 rounded-lg p-4 flex justify-between items-center bg-stone-900/40 hover:bg-stone-900/60 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div 
                    className="w-16 h-16 bg-stone-800 rounded bg-cover bg-center shrink-0 border border-stone-700" 
                    style={{ backgroundImage: `url(${beat.cover_art})` }} 
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-orange-100 truncate">{beat.title}</h3>
                    <p className="text-sm text-stone-400">{beat.genre} <span aria-hidden="true">·</span> {beat.bpm} BPM <span aria-hidden="true">·</span> {beat.key}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {editing === beat.id ? (
                    <div className="flex gap-2 items-center">
                      <input 
                        type="number" 
                        value={editPrices.price_wav} 
                        onChange={(e) => setEditPrices({ price_wav: e.target.value })} 
                        className="w-24 bg-black border border-stone-700 rounded px-2 py-1 text-sm text-white focus:border-orange-500 outline-none" 
                      />
                      <button 
                        onClick={() => saveEdit(beat.id)} 
                        className="text-sm bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => setEditing(null)} 
                        className="text-sm text-stone-400 hover:text-stone-200 focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none touch-manipulation"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-orange-400 tabular-nums">KSh {beat.price_wav}</span>
                      <button 
                        onClick={() => startEdit(beat)} 
                        className="text-sm text-orange-400 hover:text-orange-300 hover:underline focus-visible:ring-2 focus-visible:ring-orange-500 rounded outline-none touch-manipulation"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(beat)} 
                        className="text-sm text-red-400 hover:text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}