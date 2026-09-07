import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { getPublishedReleases } from '@/lib/store';
import { absoluteUrl, SITE_NAME } from '@/lib/site';
import { StoreBrowser } from '@/components/store/StoreBrowser';
import { EmptyState } from '@/components/EmptyState';

// Rendered on the server so the catalogue is in the HTML for Google.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Store — Singles & Albums',
  description:
    'Buy singles and albums from jst.dan and tisco prodz. Stream any release free, pay with M-Pesa to download.',
  alternates: { canonical: absoluteUrl('/store') },
  openGraph: {
    title: `Store — ${SITE_NAME}`,
    description: 'Stream free. Pay with M-Pesa to download.',
    url: absoluteUrl('/store'),
    type: 'website',
  },
};

export default async function StorePage() {
  const releases = await getPublishedReleases();

  return (
    <div className="min-h-screen bg-black text-white pb-48 md:pb-32">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-orange-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-orange-50 mb-2">Store</h1>
        <p className="text-stone-500">
          {/* Was "Play anything free". That stopped being true the moment
              premieres landed: a record before its date cannot be played at
              all. The qualifier is small but the claim was the kind a visitor
              can disprove in one click. */}
          Singles and albums. Play a released record free — pay only when you want
          the file.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {releases.length === 0 ? (
          <EmptyState
            title="No releases yet"
            body="Singles and albums from jst.dan and tisco prodz land here. The beats catalogue is already open."
            action={{ label: 'Browse the beats', href: '/beats' }}
          />
        ) : (
          <StoreBrowser releases={releases} />
        )}
      </div>
    </div>
  );
}
