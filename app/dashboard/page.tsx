'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { UploadForm } from '@/components/upload/UploadForm';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';

export default function DashboardPage() {
  const { isLoggedIn, logout } = useAuthStore();
  const router = useRouter();
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [isLoggedIn, mounted, router]);

  const fetchBeats = async () => {
    const { data, error } = await supabase.from('beats').select('*').order('created_at', { ascending: false });
    if (error) console.error('Fetch error:', error);
    setBeats(data || []);
    setLoading(false);
  };

  const handleDelete = async (beat: Beat) => {
    if (!confirm(`Delete "${beat.title}"?`)) return;

    // 1. Delete from database FIRST
    const { error: dbError } = await supabase.from('beats').delete().eq('id', beat.id);
    
    if (dbError) {
      console.error('Delete failed:', dbError);
      setMessage(`Error: ${dbError.message}`);
      return;
    }

    // 2. Try to delete files from storage (don't fail if missing)
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
      // Ignore storage errors - files might not exist for seeded beats
    }

    // 3. Remove from UI
    setBeats(beats.filter((b) => b.id !== beat.id));
    setMessage('Deleted');
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
      setBeats(beats.map((b) => b.id === beatId ? { ...b, price_wav: newPrice } : b));
      setEditing(null);
      setMessage('Updated');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(`Error: ${error.message}`);
    }
  };

  if (!mounted || !isLoggedIn) {
    return <div className="max-w-4xl mx-auto p-6"><p className="text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Producer Dashboard</h1>
        <button onClick={logout} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>

      {message && (
        <div className={`p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      <UploadForm />

      <div>
        <h2 className="text-xl font-bold mb-4">Your Beats ({beats.length})</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : beats.length === 0 ? (
          <p className="text-gray-500">No beats.</p>
        ) : (
          <div className="space-y-3">
            {beats.map((beat) => (
              <div key={beat.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded bg-cover bg-center" style={{ backgroundImage: `url(${beat.cover_art})` }} />
                  <div>
                    <h3 className="font-bold">{beat.title}</h3>
                    <p className="text-sm text-gray-500">{beat.genre} • {beat.bpm} BPM</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {editing === beat.id ? (
                    <div className="flex gap-2 items-center">
                      <input type="number" value={editPrices.price_wav} onChange={(e) => setEditPrices({ price_wav: e.target.value })} className="w-20 border rounded px-2 py-1 text-sm" />
                      <button onClick={() => saveEdit(beat.id)} className="text-sm bg-black text-white px-3 py-1 rounded">Save</button>
                      <button onClick={() => setEditing(null)} className="text-sm text-gray-500">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold">KSh {beat.price_wav}</span>
                      <button onClick={() => startEdit(beat)} className="text-sm text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(beat)} className="text-sm text-red-600 hover:underline">Delete</button>
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
