import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Email -> producer display name. The client (lib/supabase.ts) stores the
// session in localStorage, not a cookie, so API routes can't read it
// automatically — the frontend must send it as `Authorization: Bearer <token>`
// and we verify that token ourselves against Supabase Auth (server-side,
// can't be spoofed by the browser).
const UPLOADER_EMAILS: Record<string, 'jst.dan' | 'tisco prodz'> = {
  'dwachira2002@gmail.com': 'jst.dan',
  'tscoprodz@gmail.com': 'tisco prodz',
};

export interface Uploader {
  email: string;
  producer: 'jst.dan' | 'tisco prodz';
}

/**
 * Verifies the request's bearer token is a real, currently-valid Supabase
 * session for one of the two allowed uploader accounts. Returns the
 * caller's email + producer name, or null if unauthorized.
 */
export async function requireUploaderInfo(req: NextRequest): Promise<Uploader | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const producer = UPLOADER_EMAILS[data.user.email];
  return producer ? { email: data.user.email, producer } : null;
}

/** Same check, just the producer name — for routes that don't need the email. */
export async function requireUploader(req: NextRequest): Promise<'jst.dan' | 'tisco prodz' | null> {
  const info = await requireUploaderInfo(req);
  return info?.producer ?? null;
}
