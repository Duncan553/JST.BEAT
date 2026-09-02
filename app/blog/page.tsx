import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { EmptyState } from '@/components/EmptyState';

// Server component: the list is rendered on the server so Google actually
// sees the posts in the HTML. A client-side fetch would leave crawlers
// looking at an empty page.
export const revalidate = 300; // re-render at most every 5 minutes

export const metadata: Metadata = {
  title: 'Album Reviews',
  description: 'Album reviews scored out of 10, plus music writing from jst.dan and tisco prodz.',
  alternates: { canonical: absoluteUrl('/blog') },
  openGraph: {
    title: `Album Reviews — ${SITE_NAME}`,
    description: 'Album reviews scored out of 10, plus music writing from jst.dan and tisco prodz.',
    url: absoluteUrl('/blog'),
    type: 'website',
  },
};

type PostRow = {
  id: string;
  slug: string;
  title: string;
  album_artist: string | null;
  album_title: string | null;
  standout_track: string | null;
  standout_producer: string | null;
  cover_art: string | null;
  body: string;
  rating: number | null;
  created_at: string;
  author: string;
};

async function getPosts(): Promise<PostRow[]> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, slug, title, album_artist, album_title, standout_track, standout_producer, cover_art, body, rating, created_at, author')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[Blog] list error:', error.message);
    return [];
  }
  return data || [];
}

/** Ten dots, filled to the score. Reads at a glance on a phone. */
export function RatingDots({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`w-1.5 h-1.5 rounded-full ${i < Math.round(rating) ? 'bg-orange-500' : 'bg-stone-700'}`}
        />
      ))}
      <span className="ml-1.5 text-sm font-bold text-orange-400 tabular-nums">{rating}/10</span>
    </span>
  );
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className="min-h-screen bg-black text-white pb-48 md:pb-32">
      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-orange-50 mb-3">
          JST<span className="text-orange-500">.</span>BLOG
        </h1>
        <p className="text-stone-500 text-lg">Album reviews, scored out of 10.</p>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        {posts.length === 0 ? (
          <EmptyState
            title="No reviews published yet"
            body="Album reviews scored out of 10, with the standout track and producer called out. First one is coming."
            action={{ label: 'Browse the beats', href: '/beats' }}
          />
        ) : (
          <div className="space-y-4 motion-stagger">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block border border-stone-800 rounded-xl p-5 bg-stone-900/30 hover:bg-stone-900/60 hover:border-stone-700 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 outline-none"
              >
                <article className="flex gap-4">
                  {post.cover_art && (
                    <Image
                      src={post.cover_art}
                      alt=""
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded object-cover border border-stone-700 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-orange-100 mb-1">{post.title}</h2>
                    {post.album_artist && (
                      <p className="text-sm text-stone-400 mb-2 truncate">
                        {post.album_artist}
                        {post.album_title ? ` — ${post.album_title}` : ''}
                      </p>
                    )}
                    <p className="text-sm text-stone-500 line-clamp-2 mb-2">{post.body.slice(0, 160)}</p>
                    {post.standout_track && (
                      <p className="text-xs text-stone-500 mb-2">
                        <span className="text-stone-600">Best song:</span>{' '}
                        <span className="text-orange-300">{post.standout_track}</span>
                        {post.standout_producer && <span className="text-stone-500"> — {post.standout_producer}</span>}
                      </p>
                    )}
                    <div className="flex items-center gap-4 flex-wrap">
                      {post.rating !== null && <RatingDots rating={post.rating} />}
                      <time className="text-xs text-stone-600" dateTime={post.created_at}>
                        {new Date(post.created_at).toLocaleDateString('en-KE', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </time>
                      <span className="text-xs text-stone-600">by {post.author}</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
