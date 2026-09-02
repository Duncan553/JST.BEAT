import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { absoluteUrl, SITE_NAME, safeJsonLd } from '@/lib/site';
import { RatingDots } from '../page';

export const revalidate = 300;

// The two producers' own names. A review of THEIR OWN record is self-serving
// in Google's terms and is ineligible for review rich results — emitting the
// markup anyway risks a manual action, so we skip it for those.
const OWN_ARTISTS = ['jst.dan', 'tisco prodz', 'jst beat', 'jst.beat'];

type Post = {
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
  author: string;
  created_at: string;
  updated_at: string;
};

async function getPost(slug: string): Promise<Post | null> {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error) {
    console.error('[Blog] post fetch error:', error.message);
    return null;
  }
  return data;
}

// Pre-render every published review at build time, and keep serving new ones
// on demand as they're published.
export async function generateStaticParams() {
  const { data } = await supabaseAdmin.from('posts').select('slug').eq('published', true);
  return (data || []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Review not found' };

  const subject = [post.album_artist, post.album_title].filter(Boolean).join(' — ');
  const description =
    (post.rating !== null ? `${post.rating}/10. ` : '') +
    (subject ? `${subject}. ` : '') +
    post.body.replace(/\s+/g, ' ').slice(0, 155);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'article',
      publishedTime: post.created_at,
      modifiedTime: post.updated_at,
      images: post.cover_art ? [{ url: post.cover_art, width: 1200, height: 1200, alt: subject || post.title }] : undefined,
    },
    twitter: {
      card: post.cover_art ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: post.cover_art ? [post.cover_art] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const isSelfReview =
    !!post.album_artist && OWN_ARTISTS.includes(post.album_artist.trim().toLowerCase());
  const emitReviewMarkup = post.rating !== null && !!post.album_artist && !isSelfReview;

  // Google's Review snippet supports MusicRecording (MusicAlbum is not on the
  // supported list), so the album is described as a MusicRecording here.
  //
  // bestRating/worstRating are NOT optional for us: the default scale is 1–5,
  // so a bare ratingValue of 8.5 would be read as out of range and dropped.
  const jsonLd = emitReviewMarkup
    ? {
        '@context': 'https://schema.org',
        '@type': 'Review',
        name: post.title,
        url: absoluteUrl(`/blog/${post.slug}`),
        datePublished: post.created_at,
        dateModified: post.updated_at,
        author: { '@type': 'Person', name: post.author },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
        itemReviewed: {
          '@type': 'MusicRecording',
          name: post.album_title || post.title,
          byArtist: { '@type': 'MusicGroup', name: post.album_artist },
          ...(post.cover_art ? { image: post.cover_art } : {}),
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: post.rating,
          bestRating: 10,
          worstRating: 0,
        },
        reviewBody: post.body.slice(0, 5000),
        ...(post.standout_track
          ? {
              positiveNotes: {
                '@type': 'ItemList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: post.standout_producer
                      ? `${post.standout_track} (produced by ${post.standout_producer})`
                      : post.standout_track,
                  },
                ],
              },
            }
          : {}),
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        url: absoluteUrl(`/blog/${post.slug}`),
        datePublished: post.created_at,
        dateModified: post.updated_at,
        author: { '@type': 'Person', name: post.author },
        publisher: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
        ...(post.cover_art ? { image: post.cover_art } : {}),
      };

  const paragraphs = post.body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <div className="min-h-screen bg-black text-white pb-48 md:pb-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <div className="max-w-3xl mx-auto px-6 pt-6">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All reviews
        </Link>
      </div>

      <article className="max-w-3xl mx-auto px-6 py-10">
        {post.cover_art && (
          <Image
            src={post.cover_art}
            alt={post.album_title ? `${post.album_title} artwork` : ''}
            width={400}
            height={400}
            className="w-48 h-48 md:w-64 md:h-64 rounded-xl object-cover border border-stone-800 mb-8"
            priority
          />
        )}

        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-orange-50 mb-3" style={{ textWrap: 'balance' }}>
          {post.title}
        </h1>

        {/* Skip the subtitle when the headline already says the same thing —
            "Drake — Iceman" twice in a row just reads as a mistake. */}
        {post.album_artist &&
          `${post.album_artist}${post.album_title ? ` — ${post.album_title}` : ''}`.toLowerCase() !==
            post.title.trim().toLowerCase() && (
            <p className="text-lg text-stone-400 mb-4">
              {post.album_artist}
              {post.album_title ? ` — ${post.album_title}` : ''}
            </p>
          )}

        <div className="flex items-center gap-4 flex-wrap mb-8 pb-8 border-b border-stone-800">
          {post.rating !== null && <RatingDots rating={post.rating} />}
          <time className="text-sm text-stone-600" dateTime={post.created_at}>
            {new Date(post.created_at).toLocaleDateString('en-KE', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
          <span className="text-sm text-stone-600">by {post.author}</span>
        </div>

        {post.standout_track && (
          <aside className="mb-8 border-l-2 border-orange-600 pl-4 py-1">
            <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">Best song</p>
            <p className="text-lg font-bold text-orange-100">{post.standout_track}</p>
            {post.standout_producer && (
              <p className="text-sm text-stone-400">produced by {post.standout_producer}</p>
            )}
          </aside>
        )}

        <div className="space-y-5 text-stone-300 leading-relaxed text-lg">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
