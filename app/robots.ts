import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// Builds /robots.txt. Two jobs: point crawlers at the sitemap, and keep them
// out of pages that would waste crawl budget or expose nothing useful.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',       // no crawlable content, and some routes are auth-only
          '/dashboard',  // producer-only
          '/login',
          '/cart',       // per-visitor state, nothing to rank
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
