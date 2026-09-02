import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { absoluteUrl } from '@/lib/site';

// Next builds /sitemap.xml from this. Without it, Google has no reliable way
// to discover individual beat, release and review pages — they're only
// reachable by crawling links, and anything below the fold on a JS-rendered
// list can be missed entirely.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/beats'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/store'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/blog'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // /cart, /login and /dashboard are deliberately absent — they're either
  // private or have nothing to rank for.

  const [beats, releases, posts] = await Promise.all([
    supabaseAdmin.from('beats').select('id, created_at'),
    supabaseAdmin.from('releases').select('id, created_at').eq('published', true),
    supabaseAdmin.from('posts').select('slug, updated_at').eq('published', true),
  ]);

  const beatRoutes: MetadataRoute.Sitemap = (beats.data || []).map((b) => ({
    url: absoluteUrl(`/beats/${b.id}`),
    lastModified: b.created_at ? new Date(b.created_at) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // TODO: re-enable once app/store/[id]/page.tsx exists. A sitemap that
  // lists URLs returning 404 is worse than omitting them — Google counts it
  // as a quality signal against the site.
  const releaseRoutes: MetadataRoute.Sitemap = [];
  void releases;

  const postRoutes: MetadataRoute.Sitemap = (posts.data || []).map((p) => ({
    url: absoluteUrl(`/blog/${p.slug}`),
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...beatRoutes, ...releaseRoutes, ...postRoutes];
}
