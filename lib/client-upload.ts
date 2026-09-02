'use client';

import { supabase } from '@/lib/supabase';
import type { UploadKind } from '@/lib/upload-kinds';

// Browser-side upload path. The rule now: FILES GO STRAIGHT TO SUPABASE,
// only JSON goes to our own API.
//
// Why: Vercel rejects any request body over ~4.5MB with a plain-text 413
// ("Request Entity Too Large / FUNCTION_PAYLOAD_TOO_LARGE") before the route
// handler runs. Posting a 40MB WAV to /api/... could never work in production,
// and because the reply was plain text, `res.json()` blew up with
// `Unexpected token 'R'` — which is what made it look like a JSON bug.

/** The bearer token our API routes verify. Throws if nobody is logged in. */
async function authToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not logged in — sign in again and retry.');
  return token;
}

/**
 * POSTs JSON to one of our API routes and parses the reply SAFELY.
 *
 * Every caller used to do a bare `await res.json()`. When a proxy (or a crash,
 * or a timeout) answers with plain text or an HTML error page, that throws a
 * parse error and the real status is lost. This reads the body as text first
 * and only then decides, so the producer sees the actual problem.
 */
export async function apiPost<T = any>(url: string, body: unknown, method: 'POST' | 'PATCH' = 'POST'): Promise<T> {
  const token = await authToken();
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: a proxy or platform error, not our route talking.
    if (res.status === 413) throw new Error('Request too large for the server. This should no longer happen — report it.');
    throw new Error(`Server error ${res.status}: ${text.slice(0, 120) || 'empty response'}`);
  }

  if (!res.ok) throw new Error(parsed?.error || `Request failed (${res.status})`);
  return parsed as T;
}

/**
 * Uploads one file directly to Supabase Storage and returns the stored path,
 * which is all our API routes need afterwards.
 *
 * Two steps: ask our server for a one-time token (it decides bucket + path),
 * then PUT the bytes to Supabase. The PUT is done with XMLHttpRequest instead
 * of fetch purely so `onProgress` can exist — a 40MB upload over mobile data
 * with no progress bar is indistinguishable from a hang.
 */
export async function uploadDirect(
  kind: UploadKind,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const { bucket, path, token } = await apiPost<{ bucket: string; path: string; token: string }>(
    '/api/uploads/sign',
    { kind, filename: file.name, contentType: file.type, size: file.size }
  );

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  const url = `${base}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(token)}`;

  // Same shape supabase-js sends for a Blob body: multipart with the file in
  // an unnamed field. Anything else and Storage rejects it.
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('', file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = xhr.responseText?.slice(0, 160) || `status ${xhr.status}`;
      try { msg = JSON.parse(xhr.responseText).message || msg; } catch { /* keep raw text */ }
      reject(new Error(`Upload of ${file.name} failed: ${msg}`));
    };
    xhr.onerror = () => reject(new Error(`Network error while uploading ${file.name}. Check your connection and retry.`));
    xhr.send(form);
  });

  return path;
}
