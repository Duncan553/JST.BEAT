'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { UploadForm } from '@/components/upload/UploadForm';
import { supabase } from '@/lib/supabase';
import { Beat } from '@/types/beat';

type Tab = 'beats' | 'store' | 'blog' | 'art';

export default function DashboardPage() {
  const { isLoggedIn, logout } = useAuthStore();
  const { beats, loading, fetchBeats, updateBeat, removeBeat } = useBeatsStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('beats');
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState({ price_wav: '', price_stems: '' });
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
        const parts = beat.snippet_url.split('/beats-public/');
        if (parts[1]) await supabase.storage.from('beats-public').remove([parts[1]]);
      }
      if (beat.cover_art) {
        const parts = beat.cover_art.split('/beats-public/');
        if (parts[1]) await supabase.storage.from('beats-public').remove([parts[1]]);
      }
      if (beat.full_url) {
        const parts = beat.full_url.split('/beats-private/');
        if (parts[1]) await supabase.storage.from('beats-private').remove([parts[1]]);
      }
      if (beat.stems_url) {
        const parts = beat.stems_url.split('/beats-private/');
        if (parts[1]) await supabase.storage.from('beats-private').remove([parts[1]]);
      }
    } catch (e) {
      console.error('Storage cleanup error:', e);
    }

    removeBeat(beat.id);
    setMessage('Deleted successfully');
    setTimeout(() => setMessage(''), 2000);
  };

  const startEdit = (beat: Beat) => {
    setEditing(beat.id);
    setEditPrices({ 
      price_wav: beat.price_wav.toString(),
      price_stems: beat.price_stems.toString()
    });
  };

  const saveEdit = async (beatId: string) => {
    const newPriceWav = parseFloat(editPrices.price_wav);
    const newPriceStems = parseFloat(editPrices.price_stems);

    if (!Number.isFinite(newPriceWav) || newPriceWav <= 0) {
      setMessage('Error: WAV price must be greater than 0');
      return;
    }

    const updates: any = { price_wav: newPriceWav };
    if (Number.isFinite(newPriceStems) && newPriceStems >= 0) {
      updates.price_stems = newPriceStems;
    }

    const { error } = await supabase.from('beats').update(updates).eq('id', beatId);

    if (!error) {
      updateBeat(beatId, updates);
      setEditing(null);
      setMessage('Updated successfully');
      setTimeout(() => setMessage(''), 2000);
    } else {
      setMessage(`Error: ${error.message}`);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'beats', label: 'Beats' },
    { key: 'store', label: 'Store' },
    { key: 'blog', label: 'Blog' },
    { key: 'art', label: 'Art Museum' },
  ];

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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-800 pb-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition whitespace-nowrap focus-visible:ring-2 focus-visible:ring-orange-500 outline-none ${
              activeTab === tab.key
                ? 'bg-stone-900 text-orange-400 border-b-2 border-orange-500'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* BEATS TAB */}
      {activeTab === 'beats' && (
        <>
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
                        <p className="text-sm text-stone-400">{beat.genre} · {beat.bpm} BPM · {beat.key}</p>
                        <p className="text-xs text-stone-600 mt-1">
                          {beat.stems_url ? '✅ Has stems ZIP' : '❌ No stems'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {editing === beat.id ? (
                        <div className="flex gap-4 items-center">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-stone-500">WAV</label>
                            <input 
                              type="number" 
                              value={editPrices.price_wav} 
                              onChange={(e) => setEditPrices(prev => ({ ...prev, price_wav: e.target.value }))} 
                              className="w-24 bg-black border border-stone-700 rounded px-2 py-1 text-sm text-white focus:border-orange-500 outline-none" 
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs text-stone-500">STEMS</label>
                            <input 
                              type="number" 
                              value={editPrices.price_stems} 
                              onChange={(e) => setEditPrices(prev => ({ ...prev, price_stems: e.target.value }))} 
                              className="w-24 bg-black border border-stone-700 rounded px-2 py-1 text-sm text-white focus:border-orange-500 outline-none" 
                            />
                          </div>
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
                          <div className="text-right">
                            <p className="font-bold text-orange-400 tabular-nums">KSh {beat.price_wav} <span className="text-xs text-stone-500 font-normal">WAV</span></p>
                            {beat.price_stems > 0 && beat.stems_url ? (
                              <p className="text-sm text-stone-400 tabular-nums">KSh {beat.price_stems} <span className="text-xs text-stone-600">STEMS</span></p>
                            ) : (
                              <p className="text-xs text-stone-600">No stems</p>
                            )}
                          </div>
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
        </>
      )}

      {/* STORE TAB */}
      {activeTab === 'store' && (
        <div className="text-center py-20 border border-stone-800 rounded-xl bg-stone-900/30">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-orange-950/30 border border-orange-900/30 rounded-full mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <span className="text-orange-400 font-bold tracking-wide">COMING SOON</span>
          </div>
          <p className="text-stone-500">Store management will be here.</p>
          <p className="text-stone-600 text-sm mt-2">Add albums, merch, and exclusive drops.</p>
        </div>
      )}

      {/* BLOG TAB */}
      {activeTab === 'blog' && (
        <div className="text-center py-20 border border-stone-800 rounded-xl bg-stone-900/30">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-orange-950/30 border border-orange-900/30 rounded-full mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <span className="text-orange-400 font-bold tracking-wide">COMING SOON</span>
          </div>
          <p className="text-stone-500">Blog management will be here.</p>
          <p className="text-stone-600 text-sm mt-2">Write posts and review albums.</p>
        </div>
      )}

      {/* ART MUSEUM TAB */}
      {activeTab === 'art' && (
        <div className="text-center py-20 border border-stone-800 rounded-xl bg-stone-900/30">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-orange-950/30 border border-orange-900/30 rounded-full mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <span className="text-orange-400 font-bold tracking-wide">COMING SOON</span>
          </div>
          <p className="text-stone-500">Art Museum management will be here.</p>
          <p className="text-stone-600 text-sm mt-2">Approve artists and curate the gallery.</p>
        </div>
      )}
    </div>
  );
}
