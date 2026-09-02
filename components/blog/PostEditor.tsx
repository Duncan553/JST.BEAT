'use client';

import { useState, useEffect } from 'react';
import { uploadDirect, apiPost } from '@/lib/client-upload';

export type Post = {
  id?: string;
  slug?: string;
  title: string;
  album_artist: string | null;
  album_title: string | null;
  standout_track: string | null;
  standout_producer: string | null;
  cover_art: string | null;
  body: string;
  rating: number | null;
  published: boolean;
};

const EMPTY: Post = {
  title: '', album_artist: '', album_title: '', standout_track: '', standout_producer: '', cover_art: null,
  body: '', rating: null, published: false,
};

// Mirrors slugify() in app/api/blog/posts/route.ts so the URL you're shown
// while typing is the URL you actually get.
function previewSlug(input: string): string {
  return input.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function PostEditor({
  editing,
  onSaved,
  onCancel,
}: {
  editing?: Post | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [post, setPost] = useState<Post>(EMPTY);
  const [slugOverride, setSlugOverride] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (editing) {
      setPost({
        ...editing,
        album_artist: editing.album_artist ?? '',
        album_title: editing.album_title ?? '',
        standout_track: editing.standout_track ?? '',
        standout_producer: editing.standout_producer ?? '',
      });
      setSlugOverride(editing.slug ?? '');
      setCoverPreview(editing.cover_art ?? '');
      setCover(null);
    } else {
      setPost(EMPTY);
      setSlugOverride('');
      setCoverPreview('');
      setCover(null);
    }
    setMessage('');
  }, [editing]);

  const set = <K extends keyof Post>(k: K, v: Post[K]) => setPost((p) => ({ ...p, [k]: v }));

  const pickCover = (f: File | null) => {
    setCover(f);
    if (f) setCoverPreview(URL.createObjectURL(f));
  };

  const save = async (publish: boolean) => {
    if (!post.title.trim() || !post.body.trim()) {
      setMessage('Error: a title and some body text are required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      // Artwork goes straight to Storage; the post itself is plain JSON. A
      // multipart post with the image inline used to die on Vercel's ~4.5MB
      // request-body cap and came back as unparseable plain text.
      let cover_path: string | undefined;
      if (cover) {
        setMessage('Uploading artwork...');
        cover_path = await uploadDirect('blog-cover', cover, (pct) => setMessage(`Uploading artwork ${pct}%`));
      }

      await apiPost(
        '/api/blog/posts',
        {
          id: editing?.id,
          title: post.title.trim(),
          body: post.body.trim(),
          album_artist: (post.album_artist ?? '').trim(),
          album_title: (post.album_title ?? '').trim(),
          standout_track: (post.standout_track ?? '').trim(),
          standout_producer: (post.standout_producer ?? '').trim(),
          rating: post.rating === null || post.rating === undefined ? '' : String(post.rating),
          published: String(publish),
          slug: slugOverride.trim() || undefined,
          cover_path,
        },
        editing?.id ? 'PATCH' : 'POST'
      );

      setMessage(publish ? 'Published.' : 'Saved as a draft.');
      if (!editing?.id) { setPost(EMPTY); setSlugOverride(''); setCover(null); setCoverPreview(''); }
      onSaved();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full bg-black border border-stone-700 rounded-lg px-3 py-2 text-white placeholder-stone-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-colors';

  const url = previewSlug(slugOverride || post.title);
  // Reviewing your own record is fine to publish, but Google treats a
  // self-review as ineligible for star rich results, so we don't emit the
  // Review markup for it (see app/blog/[slug]/page.tsx).
  const isReview = post.rating !== null && post.rating !== undefined;

  return (
    <div className="bg-stone-900/50 border border-stone-800 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-1 text-white">
        {editing?.id ? 'Edit post' : 'Write a review'}
      </h3>
      <p className="text-sm text-stone-500 mb-4">
        Album reviews scored out of 10. Leave the rating blank for a plain post.
      </p>

      {message && (
        <div className={`p-3 rounded mb-4 text-sm ${
          message.startsWith('Error')
            ? 'bg-red-950/40 border border-red-900/30 text-red-400'
            : 'bg-green-950/40 border border-green-900/30 text-green-400'}`} role="status">
          {message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">
            Headline <span className="text-red-500">*</span>
          </label>
          <input value={post.title} onChange={(e) => set('title', e.target.value)} className={field}
            placeholder="Burna Boy — Love, Damini" />
          {url && (
            <p className="text-xs text-stone-600 mt-1">
              URL: <span className="text-stone-400">/blog/{url}</span>
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Artist</label>
            <input value={post.album_artist ?? ''} onChange={(e) => set('album_artist', e.target.value)}
              className={field} placeholder="Burna Boy" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Album</label>
            <input value={post.album_title ?? ''} onChange={(e) => set('album_title', e.target.value)}
              className={field} placeholder="Love, Damini" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Rating / 10</label>
            <input
              type="number" min={0} max={10} step={0.5}
              value={post.rating ?? ''}
              onChange={(e) => set('rating', e.target.value === '' ? null : Number(e.target.value))}
              className={field} placeholder="8.5"
            />
            <p className="text-xs text-stone-600 mt-1">
              {isReview ? `${post.rating}/10` : 'Blank = not a review'}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Best song</label>
            <input value={post.standout_track ?? ''} onChange={(e) => set('standout_track', e.target.value)}
              className={field} placeholder="Make Them Pay" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-stone-300">Produced by</label>
            <input value={post.standout_producer ?? ''} onChange={(e) => set('standout_producer', e.target.value)}
              className={field} placeholder="Ovrkast" />
            <p className="text-xs text-stone-600 mt-1">Who made the standout beat — the credit other producers came to read.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">Album artwork</label>
          <div className="flex items-start gap-4">
            {coverPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="w-20 h-20 rounded object-cover border border-stone-700 shrink-0" />
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickCover(e.target.files?.[0] || null)}
              className="flex-1 text-stone-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-bold hover:file:bg-orange-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-stone-300">
            The review <span className="text-red-500">*</span>
          </label>
          <textarea value={post.body} onChange={(e) => set('body', e.target.value)}
            className={`${field} min-h-56 leading-relaxed`}
            placeholder={'What works, what doesn\'t, what it sounds like.\n\nBlank lines start a new paragraph.'} />
          <p className="text-xs text-stone-600 mt-1">
            Plain text. Blank lines become paragraphs on the published page.
          </p>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-stone-500 hover:text-stone-300">Custom URL (optional)</summary>
          <input value={slugOverride} onChange={(e) => setSlugOverride(e.target.value)}
            className={`${field} mt-2`} placeholder="burna-boy-love-damini" />
          <p className="text-xs text-stone-600 mt-1">
            Leave blank to build it from the headline. Changing it on a published post breaks any existing links.
          </p>
        </details>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => save(true)} disabled={busy}
            className="flex-1 min-w-40 bg-orange-600 text-white py-2.5 rounded-lg font-bold hover:bg-orange-500 disabled:bg-stone-700 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation">
            {busy ? 'Saving...' : 'Publish'}
          </button>
          <button type="button" onClick={() => save(false)} disabled={busy}
            className="flex-1 min-w-40 border border-stone-700 text-stone-300 py-2.5 rounded-lg font-bold hover:bg-stone-900 disabled:opacity-60 transition focus-visible:ring-2 focus-visible:ring-orange-500 outline-none touch-manipulation">
            Save as draft
          </button>
          {editing?.id && onCancel && (
            <button type="button" onClick={onCancel} disabled={busy}
              className="px-4 py-2.5 text-stone-400 hover:text-stone-200 rounded-lg outline-none touch-manipulation">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
