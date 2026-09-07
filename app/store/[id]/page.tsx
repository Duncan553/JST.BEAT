import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublishedRelease, getPublishedReleases } from '@/lib/store';
import { absoluteUrl, SITE_NAME, safeJsonLd } from '@/lib/site';
import { ReleasePlayer } from '@/components/store/ReleasePlayer';
import { PremiereBadge } from '@/components/store/PremiereBadge';
import { ExplicitBadge } from '@/components/store/ExplicitBadge';

export const revalidate = 300;

export async function generateStaticParams() {
  const releases = await getPublishedReleases();
  return releases.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const release = await getPublishedRelease(id);
  if (!release) return { title: 'Release not found' };

  const who = release.artist ? `${release.artist} — ` : '';
  const description =
    `${who}${release.title}. ${release.tracks.length} track${release.tracks.length === 1 ? '' : 's'}, ` +
    `KSh ${release.price}. Stream free, pay with M-Pesa to download.`;
  const url = absoluteUrl(`/store/${release.id}`);

  return {
    title: `${release.title}${release.artist ? ` — ${release.artist}` : ''}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: release.title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'music.album',
      images: [{ url: release.cover_art, width: 1200, height: 1200, alt: release.title }],
    },
    twitter: { card: 'summary_large_image', title: release.title, description, images: [release.cover_art] },
  };
}

export default async function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const release = await getPublishedRelease(id);
  if (!release) notFound();

  // MusicAlbum + an Offer, so the price and availability can show in search.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicAlbum',
    name: release.title,
    url: absoluteUrl(`/store/${release.id}`),
    image: release.cover_art,
    ...(release.artist ? { byArtist: { '@type': 'MusicGroup', name: release.artist } } : {}),
    numTracks: release.tracks.length,
    track: release.tracks.map((t) => ({
      '@type': 'MusicRecording',
      name: t.title,
      position: t.track_number,
    })),
    offers: {
      '@type': 'Offer',
      price: release.price,
      priceCurrency: 'KES',
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/store/${release.id}`),
    },
  };

  return (
    <div className="min-h-screen bg-black text-white pb-48 md:pb-32">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <div className="max-w-4xl mx-auto px-6 pt-6">
        <Link href="/store" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to store
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row gap-8 mb-10">
          {/* The badge is positioned against this wrapper, so the cover needs
              to establish the containing block — a bare <Image> has nothing for
              an absolute child to anchor to. */}
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 shrink-0">
            <Image
              src={release.cover_art}
              alt={`${release.title} cover`}
              width={320}
              height={320}
              className="w-full h-full rounded-xl object-cover border border-stone-800"
              priority
            />
            <ExplicitBadge explicit={release.explicit} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-xs uppercase tracking-wide text-stone-500">{release.kind}</p>
              <PremiereBadge premiereAt={release.premiere_at} variant="inline" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-orange-50 mb-2" style={{ textWrap: 'balance' }}>
              {release.title}
            </h1>
            {release.artist && <p className="text-lg text-stone-400 mb-1">{release.artist}</p>}
            <p className="text-sm text-stone-600 mb-5">
              produced by {release.producer} · {release.tracks.length} track{release.tracks.length === 1 ? '' : 's'}
            </p>
            {release.description && (
              <p className="text-stone-400 leading-relaxed mb-6">{release.description}</p>
            )}
          </div>
        </div>

        <ReleasePlayer release={release} />
      </div>
    </div>
  );
}
