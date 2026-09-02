// The single source of truth for "what may the browser upload, and where".
//
// Why this file exists: files no longer travel through our API routes at all.
// Vercel refuses any request body over ~4.5MB with a plain-text 413
// (FUNCTION_PAYLOAD_TOO_LARGE) BEFORE our code runs, so a 40MB WAV could never
// reach us. The browser now uploads straight to Supabase Storage and only tells
// us the path afterwards.
//
// That flips the trust model: the client picks the file. So the server must be
// the one that decides the bucket, the folder, the size cap and the mime type —
// never the client. This table is that decision, and BOTH ends use it:
//   1. /api/uploads/sign checks it before minting a one-time upload token
//   2. the finalize routes check the STORED object against it again, because a
//      client could upload something small to get the token, then... well, it
//      can't swap the file (the token is single-use and path-bound), but
//      re-checking the real object costs one call and removes the doubt.

export type UploadKind =
  | 'beat-audio'     // the full master — private, this is what a buyer pays for
  | 'beat-snippet'   // optional producer-chosen clip; gets tagged, then deleted
  | 'beat-cover'     // public art
  | 'beat-stems'     // private stems ZIP
  | 'store-audio'    // a store track master — private
  | 'store-cover'    // release art — public
  | 'blog-cover'     // post art — public
  | 'producer-photo'; // profile photo — public

const AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/wave'];
const IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const ZIP = ['application/zip', 'application/x-zip-compressed'];

const MB = 1024 * 1024;

export interface UploadRule {
  bucket: 'beats-public' | 'beats-private';
  folder: string;         // the ONLY folder this kind may write to
  mimes: string[];
  maxBytes: number;
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  'beat-audio':     { bucket: 'beats-private', folder: 'full',        mimes: AUDIO,  maxBytes: 100 * MB },
  'beat-snippet':   { bucket: 'beats-private', folder: 'snippet-src', mimes: AUDIO,  maxBytes: 100 * MB },
  'beat-cover':     { bucket: 'beats-public',  folder: 'covers',      mimes: IMAGES, maxBytes: 10 * MB },
  'beat-stems':     { bucket: 'beats-private', folder: 'stems',       mimes: ZIP,    maxBytes: 500 * MB },
  'store-audio':    { bucket: 'beats-private', folder: 'store-full',  mimes: AUDIO,  maxBytes: 100 * MB },
  'store-cover':    { bucket: 'beats-public',  folder: 'release-covers',mimes: IMAGES, maxBytes: 10 * MB },
  'blog-cover':     { bucket: 'beats-public',  folder: 'blog-covers',        mimes: IMAGES, maxBytes: 10 * MB },
  'producer-photo': { bucket: 'beats-public',  folder: 'producer-photos',   mimes: IMAGES, maxBytes: 10 * MB },
};

export function isUploadKind(v: unknown): v is UploadKind {
  return typeof v === 'string' && v in UPLOAD_RULES;
}

// Strips anything that could climb out of the folder we chose ("../", slashes)
// or upset Storage's path parser. Applied on the SERVER, so a crafted filename
// from the browser can't place a file anywhere but its own folder.
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_').slice(-80) || 'file';
}
