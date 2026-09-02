'use client';

import { useState } from 'react';
import { uploadDirect, apiPost } from '@/lib/client-upload';

type TrackRow = {
  file: File;
  title: string;
  status: 'waiting' | 'uploading' | 'done' | 'failed';
  error?: string;
};

// Strips "03 - " / "03." / "03_" prefixes and the extension, so dropping a
// folder gives you readable track titles instead of raw filenames.
function titleFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, '')          // extension
    .replace(/^\s*\d{1,3}\s*[-._)]*\s*/, '') // leading track number
    .replace(/[_]+/g, ' ')
    .trim() || name;
}

// Sorts the way a track listing should: by any leading number, then by name.
function byTrackOrder(a: File, b: File): number {
  const num = (f: File) => {
    const m = f.name.match(/^\s*(\d{1,3})/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  const d = num(a) - num(b);
  return d !== 0 ? d : a.name.localeCompare(b.name, undefined, { numeric: true });
}

const AUDIO_RE = /\.(mp3|wav)$/i;

export function ReleaseUploadForm({ onCreated }: { onCreated?: () => void }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [kind, setKind] = useState<'single' | 'album'>('album');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const pickCover = (file: File | null) => {
    setCover(file);
    // Show the artwork straight away so you can see what you picked.
    setCoverPreview(file ? URL.createObjectURL(file) : '');
  };

  // Handles both a folder drop (webkitdirectory) and a plain multi-select.
  const pickTracks = (fileList: FileList | null) => {
    if (!fileList) return;
    const audio = Array.from(fileList).filter((f) => AUDIO_RE.test(f.name));
    const skipped = fileList.length - audio.length;
    audio.sort(byTrackOrder);
    setTracks(audio.map((file) => ({ file, title: titleFromFilename(file.name), status: 'waiting' })));
    setKind(audio.length > 1 ? 'album' : 'single');
    setMessage(
      skipped > 0
        ? `${audio.length} audio file${audio.length === 1 ? '' : 's'} found (ignored ${skipped} non-audio file${skipped === 1 ? '' : 's'} in that folder).`
        : ''
    );
  };

  const renameTrack = (i: number, value: string) =>
    setTracks((prev) => prev.map((t, idx) => (idx === i ? { ...t, title: value } : t)));

  const removeTrack = (i: number) => setTracks((prev) => prev.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) =>
    setTracks((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const reset = () => {
    setTitle(''); setArtist(''); setPrice(''); setDescription('');
    setCover(null); setCoverPreview(''); setTracks([]); setKind('album');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cover) { setMessage('Error: pick the cover artwork.'); return; }
    if (tracks.length === 0) { setMessage('Error: add at least one audio file.'); return; }

    setBusy(true);
    setMessage('Creating release...');

    try {
      // Step 1 — the artwork goes straight to Storage, then the release shell
      // (title, artist, price) is created with just the path. Files never pass
      // through our API: Vercel caps request bodies at ~4.5MB.
      const cover_path = await uploadDirect('store-cover', cover);

      const relData = await apiPost<{ release: { id: string } }>('/api/store/releases', {
        title: title.trim(),
        artist: artist.trim(),
        kind,
        price,
        description: description.trim(),
        cover_path,
      });
      const releaseId = relData.release.id;

      // Step 2 — one track at a time: master to Storage first, then a tiny
      // JSON call to register it. A single failure costs you that track, not
      // the whole album.
      let failed = 0;
      for (let i = 0; i < tracks.length; i++) {
        setTracks((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: 'uploading' } : t)));

        try {
          const audio_path = await uploadDirect('store-audio', tracks[i].file, (pct) =>
            setMessage(`Uploading track ${i + 1} of ${tracks.length} — ${pct}%`)
          );
          setMessage(`Processing track ${i + 1} of ${tracks.length}...`);
          await apiPost('/api/store/tracks', {
            release_id: releaseId,
            title: tracks[i].title.trim() || tracks[i].file.name,
            track_number: i + 1,
            audio_path,
          });
          setTracks((prev) => prev.map((t, idx) => (idx === i ? { ...t, status: 'done' } : t)));
        } catch (trackErr: any) {
          failed++;
          setTracks((prev) =>
            prev.map((t, idx) => (idx === i ? { ...t, status: 'failed', error: trackErr.message } : t))
          );
        }
      }

      if (failed > 0) {
        // The release exists with the tracks that did land — it just stays
        // unpublished so nothing half-finished can be bought.
        setMessage(`Release created, but ${failed} track${failed === 1 ? '' : 's'} failed. Fix and re-upload those, then publish.`);
      } else {
        setMessage(`"${title}" uploaded with ${tracks.length} track${tracks.length === 1 ? '' : 's'}. It stays hidden until you publish it.`);
        reset();
      }
      onCreated?.();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors';

  return (
    <div className="bg-stone-900/50 border border-stone-800 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-1 text-white">Upload a release</h3>
      <p className="text-sm text-stone-500 mb-4">
        A single or a whole album. Drop the album folder and every audio file inside it becomes a track.
      </p>

      {message && (
        <div
          className={`p-3 rounded mb-4 text-sm ${
            message.startsWith('Error') || message.includes('failed')
              ? 'bg-red-950/40 border border-red-900/30 text-red-400'
              : 'bg-green-950/40 border border-green-900/30 text-green-400'
          }`}
          role="status"
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field}
              placeholder="Album or song name" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Artist / singer</label>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} className={field}
              placeholder="Who is singing on it" />
            <p className="text-xs text-stone-600 mt-1">You still get paid — this is just the name on the cover.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Type</label>
            <div className="flex gap-2">
              {(['single', 'album'] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border transition ${
                    kind === k ? 'bg-orange-600 border-orange-600 text-white'
                               : 'border-stone-700 text-stone-400 hover:border-orange-500 hover:text-orange-300'}`}>
                  {k === 'single' ? 'Single' : 'Album'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">
              Price (KSh) <span className="text-red-500">*</span>
            </label>
            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
              className={field} placeholder="800" required />
            <p className="text-xs text-stone-600 mt-1">One price for the whole release. KSh only — the store is for local buyers.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            className={`${field} min-h-20`} placeholder="Optional — a line or two about the record." />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">
            Cover artwork <span className="text-red-500">*</span>
          </label>
          <div className="flex items-start gap-4">
            {coverPreview && (
              // Local blob preview, so next/image isn't appropriate here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="w-24 h-24 rounded-lg object-cover border border-stone-700 shrink-0" />
            )}
            <div className="flex-1">
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => pickCover(e.target.files?.[0] || null)}
                className="w-full text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500"
                required />
              <p className="text-xs text-stone-600 mt-1">JPG/PNG/WEBP, under 5MB. Shown on the store page.</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">
            Tracks <span className="text-red-500">*</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-stone-500 mb-1">Pick a whole folder</p>
              <input
                type="file"
                /* webkitdirectory isn't in React's typings, but every current browser supports it */
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                onChange={(e) => pickTracks(e.target.files)}
                className="w-full text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-stone-700 file:text-white file:font-bold hover:file:bg-stone-600"
              />
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">…or choose files</p>
              <input type="file" accept="audio/*" multiple onChange={(e) => pickTracks(e.target.files)}
                className="w-full text-stone-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-stone-700 file:text-white file:font-bold hover:file:bg-stone-600" />
            </div>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Only .mp3 and .wav are picked up — artwork and text files in the folder are ignored.
            Order comes from any number at the start of the filename; you can rename and reorder below.
          </p>
        </div>

        {tracks.length > 0 && (
          <div className="border border-stone-800 rounded-lg divide-y divide-stone-800">
            <div className="px-3 py-2 bg-stone-900/60 text-xs font-bold text-stone-400 uppercase tracking-wide">
              {tracks.length} track{tracks.length === 1 ? '' : 's'}
            </div>
            {tracks.map((t, i) => (
              <div key={`${t.file.name}-${i}`} className="flex items-center gap-2 p-2">
                <span className="w-6 text-center text-xs text-stone-500 tabular-nums">{i + 1}</span>
                <input
                  value={t.title}
                  onChange={(e) => renameTrack(i, e.target.value)}
                  className="flex-1 bg-black border border-stone-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-orange-500"
                />
                <span className="text-xs text-stone-600 tabular-nums w-16 text-right shrink-0">
                  {(t.file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <span className="w-20 text-xs text-right shrink-0">
                  {t.status === 'waiting' && <span className="text-stone-600">—</span>}
                  {t.status === 'uploading' && <span className="text-orange-400">uploading</span>}
                  {t.status === 'done' && <span className="text-green-400">done</span>}
                  {t.status === 'failed' && <span className="text-red-400" title={t.error}>failed</span>}
                </span>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy}
                    className="px-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label="Move up">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === tracks.length - 1 || busy}
                    className="px-1.5 text-stone-500 hover:text-stone-200 disabled:opacity-30" aria-label="Move down">↓</button>
                  <button type="button" onClick={() => removeTrack(i)} disabled={busy}
                    className="px-1.5 text-red-400 hover:text-red-300 disabled:opacity-30" aria-label="Remove">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={busy}
          className="w-full bg-orange-600 text-white py-3 rounded-full font-bold hover:bg-orange-500 disabled:bg-stone-700 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation">
          {busy ? 'Uploading...' : `Upload ${kind === 'album' ? 'album' : 'single'}`}
        </button>
      </form>
    </div>
  );
}
