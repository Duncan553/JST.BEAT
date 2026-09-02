/**
 * One place that knows the site's public identity. Used by every page's
 * metadata, the sitemap, robots.txt and the JSON-LD blocks.
 *
 * NEXT_PUBLIC_APP_URL must be the real production origin with no trailing
 * slash — Open Graph image URLs have to be absolute or WhatsApp, Instagram
 * and X will silently show no preview at all.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://jst-beat.vercel.app').replace(/\/$/, '');

export const SITE_NAME = 'JST.BEAT';

export const SITE_DESCRIPTION =
  'Buy beats online from jst.dan and tisco prodz — boom bap, drumless, alternative hip-hop and trap. Singles and albums too. Pay with M-Pesa or card, download instantly.';

/** Absolute URL for a path. Metadata and structured data both need these. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Serialises an object for embedding in a <script type="application/ld+json">.
 *
 * JSON.stringify alone is NOT safe here. It does not escape "<", so any user
 * text containing "</script>" closes the tag early and everything after it is
 * parsed as HTML — which means a blog review body or an album artist name can
 * inject a live <script> into the page. Verified as exploitable before this
 * existed: a post body of `</script><script>...</script>` executed.
 *
 * Escaping "<" to its < form keeps the JSON semantically identical (any
 * parser reads it back as "<") while making it impossible for the HTML parser
 * to see a closing tag.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
