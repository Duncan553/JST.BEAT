'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBeatsStore } from '@/stores/useBeatsStore';
import { UploadForm } from '@/components/upload/UploadForm';
import { ReleaseUploadForm } from '@/components/store/ReleaseUploadForm';
import { PostEditor } from '@/components/blog/PostEditor';
import { supabase } from '@/lib/supabase';
import { uploadDirect, apiPost } from '@/lib/client-upload';
import { Beat } from '@/types/beat';

type Tab = 'beats' | 'store' | 'blog' | 'art' | 'earnings' | 'profile';

export default function DashboardPage() {
  const { isLoggedIn, logout, user, isLoading } = useAuthStore();
  const { beats, loading, fetchBeats, updateBeat, removeBeat } = useBeatsStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('beats');
  const [editing, setEditing] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState({ price_wav: '', price_stems: '' });
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');
  const [earnings, setEarnings] = useState<Record<string, number> | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [socials, setSocials] = useState({ whatsapp: '', instagram: '', tiktok: '', twitter: '', youtube: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [releases, setReleases] = useState<any[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Wait for initAuth's getSession() to finish before judging. isLoggedIn
    // is false while auth is still loading, so redirecting on it directly
    // kicks a genuinely logged-in producer straight back to /login.
    if (!mounted || isLoading) return;
    if (!isLoggedIn) {
      router.replace('/login');
      return;
    }
    fetchBeats();
  }, [isLoggedIn, isLoading, mounted, router, fetchBeats]);

  const handleDelete = async (beat: Beat) => {
    if (!window.confirm(`Delete "${beat.title}"? This cannot be undone.`)) return;

    // Same RLS trap as saveEdit — a blocked delete comes back as 0 rows with
    // no error. Without the row-count check we'd sail on and delete the audio
    // files below, leaving the beat listed but with every link dead.
    const { data: deleted, error: dbError } = await supabase
      .from('beats').delete().eq('id', beat.id).select();

    if (dbError) {
      console.error('Delete failed:', dbError);
      setMessage(`Error: ${dbError.message}`);
      return;
    }
    if (!deleted || deleted.length === 0) {
      setMessage('Error: nothing was deleted — the database rejected it. Files left untouched.');
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

    // `.select()` matters: when RLS blocks an update, PostgREST returns
    // ZERO rows and error === null. Checking only `error` made this report
    // "Updated successfully" while the price never actually changed.
    const { data, error } = await supabase
      .from('beats').update(updates).eq('id', beatId).select();

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setMessage('Error: nothing was saved — the database rejected the update (check the beats UPDATE policy).');
      return;
    }

    updateBeat(beatId, updates);
    setEditing(null);
    setMessage('Updated successfully');
    setTimeout(() => setMessage(''), 2000);
  };

  // Releases are read with the logged-in client, not the admin one: RLS lets
  // a producer see their own drafts, and the public only ever sees published.
  const loadReleases = async () => {
    setReleasesLoading(true);
    const { data, error } = await supabase
      .from('releases')
      .select('*, tracks(id, title, track_number)')
      .order('created_at', { ascending: false });
    if (error) setMessage(`Error loading releases: ${error.message}`);
    else setReleases(data || []);
    setReleasesLoading(false);
  };

  const togglePublish = async (release: any) => {
    const { data, error } = await supabase
      .from('releases')
      .update({ published: !release.published })
      .eq('id', release.id)
      .select();
    // Same 0-rows-no-error trap as the beats editor — check the row count.
    if (error) { setMessage(`Error: ${error.message}`); return; }
    if (!data || data.length === 0) { setMessage('Error: nothing changed — the database rejected it.'); return; }
    loadReleases();
  };

  const deleteRelease = async (release: any) => {
    if (!window.confirm(`Delete "${release.title}" and all its tracks? This cannot be undone.`)) return;
    // tracks cascade via the foreign key, so one delete clears both tables.
    const { data, error } = await supabase.from('releases').delete().eq('id', release.id).select();
    if (error) { setMessage(`Error: ${error.message}`); return; }
    if (!data || data.length === 0) { setMessage('Error: nothing was deleted.'); return; }
    setMessage('Release deleted');
    setTimeout(() => setMessage(''), 2000);
    loadReleases();
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    const { data, error } = await supabase
      .from('posts').select('*').order('created_at', { ascending: false });
    if (error) setMessage(`Error loading posts: ${error.message}`);
    else setPosts(data || []);
    setPostsLoading(false);
  };

  const deletePost = async (post: any) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    const { data, error } = await supabase.from('posts').delete().eq('id', post.id).select();
    if (error) { setMessage(`Error: ${error.message}`); return; }
    if (!data || data.length === 0) { setMessage('Error: nothing was deleted.'); return; }
    if (editingPost?.id === post.id) setEditingPost(null);
    loadPosts();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'beats', label: 'Beats' },
    { key: 'store', label: 'Store' },
    { key: 'blog', label: 'Blog' },
    { key: 'art', label: 'Art Museum' },
    { key: 'earnings', label: 'Earnings' },
    { key: 'profile', label: 'Profile' },
  ];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');

    if (newPassword.length < 6) {
      setPasswordMessage('Error: Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Error: Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    // Already-logged-in users can set their own new password directly —
    // no need for the old one, the active session is the proof of identity.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordMessage(`Error: ${error.message}`);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('Password updated successfully');
  };

  const loadEarnings = async () => {
    setEarningsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/admin/earnings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setEarnings(data.totals);
    } catch (e) {
      console.error('Earnings load error:', e);
    } finally {
      setEarningsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'earnings' && isLoggedIn) loadEarnings();
  }, [activeTab, isLoggedIn]);

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch('/api/producers');
      const data = await res.json();
      const mine = (data.producers || []).find((p: any) => p.email === user?.email);
      if (mine) {
        setProfilePhotoUrl(mine.photo_url || '');
        setFullName(mine.full_name || '');
        setSocials({
          whatsapp: mine.whatsapp || '',
          instagram: mine.instagram || '',
          tiktok: mine.tiktok || '',
          twitter: mine.twitter || '',
          youtube: mine.youtube || '',
        });
      }
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage('');

    try {
      // A new photo (if any) goes to Storage first; the profile save itself is
      // small JSON. Leaving photo_path out means "keep the current photo".
      let photo_path: string | undefined;
      if (profilePhoto) {
        setProfileMessage('Uploading photo...');
        photo_path = await uploadDirect('producer-photo', profilePhoto);
      }

      const data = await apiPost<{ producer?: { photo_url?: string } }>('/api/producers/update', {
        photo_path,
        full_name: fullName,
        whatsapp: socials.whatsapp,
        instagram: socials.instagram,
        tiktok: socials.tiktok,
        twitter: socials.twitter,
        youtube: socials.youtube,
      });

      if (data.producer?.photo_url) setProfilePhotoUrl(data.producer.photo_url);
      setProfilePhoto(null);
      setProfileMessage('Profile updated successfully');
    } catch (err: any) {
      setProfileMessage(`Error: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'profile' && isLoggedIn) loadProfile();
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    if (activeTab === 'store' && isLoggedIn) loadReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoggedIn]);

  useEffect(() => {
    if (activeTab === 'blog' && isLoggedIn) loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoggedIn]);

  if (!mounted || isLoading || !isLoggedIn) {
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
              // Skeleton rows in the shape of the list that's coming, so the
              // page doesn't jump when the beats land.
              <div className="space-y-3 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: 'var(--surface-1)' }} />
                ))}
              </div>
            ) : beats.length === 0 ? (
              <div
                className="rounded-2xl border px-6 py-10 text-center"
                style={{ borderColor: 'var(--line)', backgroundColor: 'var(--surface-1)' }}
              >
                <p className="font-display text-lg font-bold" style={{ color: 'var(--text-1)' }}>
                  Nothing uploaded yet
                </p>
                <p className="mt-1.5 text-sm" style={{ color: 'var(--text-3)' }}>
                  Use the form above — the beat goes live the moment it saves.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {beats.map((beat) => (
                  <div key={beat.id} className="border border-stone-800 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-stone-900/40 hover:bg-stone-900/60 transition-colors">
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

                    <div className="flex items-center gap-4 shrink-0 flex-wrap">
                      {editing === beat.id ? (
                        <div className="flex gap-4 items-center flex-wrap">
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
        <div className="space-y-8">
          <ReleaseUploadForm onCreated={loadReleases} />

          <div>
            <h2 className="text-xl font-bold mb-4 text-orange-50">Your releases ({releases.length})</h2>
            {releasesLoading ? (
              <div className="space-y-3 animate-pulse">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-1)' }} />
                ))}
              </div>
            ) : releases.length === 0 ? (
              <p className="text-stone-500">Nothing uploaded yet.</p>
            ) : (
              <div className="space-y-3">
                {releases.map((r: any) => (
                  <div key={r.id} className="border border-stone-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-stone-900/40">
                    <div
                      className="w-16 h-16 bg-stone-800 rounded bg-cover bg-center shrink-0 border border-stone-700"
                      style={{ backgroundImage: `url(${r.cover_art})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-orange-100 truncate">{r.title}</h3>
                      <p className="text-sm text-stone-400">
                        {r.artist || 'No artist set'} · {r.kind} · {r.tracks?.length ?? 0} track{(r.tracks?.length ?? 0) === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-stone-600 mt-1">KSh {r.price} · {r.producer}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full ${r.published ? 'bg-green-950/50 text-green-400' : 'bg-stone-800 text-stone-400'}`}>
                        {r.published ? 'Live' : 'Hidden'}
                      </span>
                      <button
                        onClick={() => togglePublish(r)}
                        className="text-sm bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                      >
                        {r.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => deleteRelease(r)}
                        className="text-sm text-red-400 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BLOG TAB */}
      {activeTab === 'blog' && (
        <div className="space-y-8">
          <PostEditor
            editing={editingPost}
            onSaved={() => { setEditingPost(null); loadPosts(); }}
            onCancel={() => setEditingPost(null)}
          />

          <div>
            <h2 className="text-xl font-bold mb-4 text-orange-50">Your posts ({posts.length})</h2>
            {postsLoading ? (
              <div className="space-y-3 animate-pulse">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-1)' }} />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <p className="text-stone-500">Nothing written yet.</p>
            ) : (
              <div className="space-y-3">
                {posts.map((p: any) => (
                  <div key={p.id} className="border border-stone-800 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 bg-stone-900/40">
                    {p.cover_art && (
                      <div className="w-16 h-16 bg-stone-800 rounded bg-cover bg-center shrink-0 border border-stone-700"
                        style={{ backgroundImage: `url(${p.cover_art})` }} />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-orange-100 truncate">{p.title}</h3>
                      <p className="text-sm text-stone-400 truncate">
                        {p.album_artist ? `${p.album_artist}${p.album_title ? ' — ' + p.album_title : ''}` : 'No album linked'}
                      </p>
                      <p className="text-xs text-stone-600 mt-1">/blog/{p.slug} · {p.author}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {p.rating !== null && (
                        <span className="text-sm font-bold text-orange-400 tabular-nums">{p.rating}/10</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${p.published ? 'bg-green-950/50 text-green-400' : 'bg-stone-800 text-stone-400'}`}>
                        {p.published ? 'Live' : 'Draft'}
                      </span>
                      <button onClick={() => setEditingPost(p)}
                        className="text-sm bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-500 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation">
                        Edit
                      </button>
                      <button onClick={() => deletePost(p)}
                        className="text-sm text-red-400 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-500 rounded outline-none touch-manipulation">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {/* EARNINGS TAB */}
      {activeTab === 'earnings' && (
        <div>
          <h2 className="text-xl font-bold mb-2 text-orange-50">Earnings by producer</h2>
          <p className="text-sm text-stone-500 mb-6">
            From paid orders. No Paystack split is set up yet — use these totals to pay
            tisco prodz manually until that&apos;s wired up.
          </p>
          {earningsLoading ? (
            <div className="space-y-3 animate-pulse">
              {[0, 1].map((i) => (
                <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--surface-1)' }} />
              ))}
            </div>
          ) : earnings ? (
            <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
              {Object.entries(earnings)
                .filter(([, total]) => total > 0)
                .map(([producer, total]) => (
                  <div key={producer} className="border border-stone-800 rounded-xl p-5 bg-stone-900/40">
                    <p className="text-sm text-stone-400 mb-1">{producer}</p>
                    <p className="text-2xl font-bold text-orange-400 tabular-nums">KSh {total.toFixed(2)}</p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-stone-500">No paid orders yet.</p>
          )}
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === 'profile' && (
        <div className="max-w-sm space-y-12">
          <div>
            <h2 className="text-xl font-bold mb-2 text-orange-50">Your profile</h2>
            <p className="text-sm text-stone-500 mb-6">{user?.email}</p>

            {profileLoading ? (
              <p className="text-stone-500 text-sm">Loading...</p>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">Full name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Shown on the About page next to your producer name"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                  <p className="text-xs text-stone-600 mt-1">Optional — nobody but you should set this.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">Photo</label>
                  {profilePhotoUrl && !profilePhoto && (
                    <Image
                      src={profilePhotoUrl}
                      alt=""
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-full object-cover border border-stone-700 mb-2"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
                    className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">WhatsApp</label>
                  <input
                    value={socials.whatsapp}
                    onChange={(e) => setSocials((s) => ({ ...s, whatsapp: e.target.value }))}
                    placeholder="0712345678"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">Instagram</label>
                  <input
                    value={socials.instagram}
                    onChange={(e) => setSocials((s) => ({ ...s, instagram: e.target.value }))}
                    placeholder="username"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">TikTok</label>
                  <input
                    value={socials.tiktok}
                    onChange={(e) => setSocials((s) => ({ ...s, tiktok: e.target.value }))}
                    placeholder="username"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">X / Twitter</label>
                  <input
                    value={socials.twitter}
                    onChange={(e) => setSocials((s) => ({ ...s, twitter: e.target.value }))}
                    placeholder="username"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-stone-300">YouTube</label>
                  <input
                    value={socials.youtube}
                    onChange={(e) => setSocials((s) => ({ ...s, youtube: e.target.value }))}
                    placeholder="channel URL"
                    className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                  />
                </div>

                {profileMessage && (
                  <p className={`text-sm ${profileMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`} role="alert">
                    {profileMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-500 disabled:bg-stone-700 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
                >
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            )}
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-stone-300">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-stone-300">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors"
                minLength={6}
                required
              />
            </div>

            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`} role="alert">
                {passwordMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-500 disabled:bg-stone-700 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation"
            >
              {passwordSaving ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
