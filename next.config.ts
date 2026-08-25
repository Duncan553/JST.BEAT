import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Every cover_art/photo_url in the DB is a Supabase Storage URL — this
    // is what lets next/image actually optimize them (resize, serve
    // webp/avif, lazy-load) instead of rejecting them as an unknown host.
    remotePatterns: [
      { protocol: 'https', hostname: 'noulpguxufwzlknzhgqd.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.paystack.co https://noulpguxufwzlknzhgqd.supabase.co; media-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
