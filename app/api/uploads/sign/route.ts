import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { UPLOAD_RULES, isUploadKind, sanitizeFilename } from '@/lib/upload-kinds';
import crypto from 'crypto';

// Mints a ONE-TIME, path-bound upload token so the browser can push a file
// straight into Supabase Storage without it passing through Vercel (whose
// 4.5MB request-body cap made every real beat upload impossible).
//
// The request body here is pure JSON — a few hundred bytes — so it is never
// anywhere near the cap. The bytes go browser -> Supabase, direct.
//
// This route is the whole security boundary for uploads. If it hands out a
// token, a file WILL land in the bucket. So: auth first, whitelist second,
// and the server (never the client) decides bucket + path.

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generous, because one beat legitimately needs up to 4 tokens (audio,
  // snippet, cover, stems) and an album needs one per track.
  const limit = rateLimit(`sign:${uploader.email}`, 300, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many uploads, try again later' }, { status: 429 });
  }

  let body: { kind?: unknown; filename?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isUploadKind(body.kind)) {
    return NextResponse.json({ error: 'Unknown upload kind' }, { status: 400 });
  }
  const rule = UPLOAD_RULES[body.kind];

  const contentType = String(body.contentType || '').toLowerCase();
  if (!rule.mimes.includes(contentType)) {
    return NextResponse.json(
      { error: `Wrong file type for ${body.kind}. Allowed: ${rule.mimes.join(', ')}. Got: ${contentType || 'unknown'}` },
      { status: 400 }
    );
  }

  // Client-declared size — cheap early rejection so the producer isn't told
  // "too big" only after waiting out a 40MB upload. The real enforcement is
  // the re-check against stored metadata in the finalize routes.
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: 'Missing file size' }, { status: 400 });
  }
  if (size > rule.maxBytes) {
    return NextResponse.json(
      { error: `File is too large (${(size / 1048576).toFixed(1)}MB). Max for ${body.kind} is ${Math.round(rule.maxBytes / 1048576)}MB.` },
      { status: 400 }
    );
  }

  // Path is built here, from the rule's folder — the client only contributes a
  // sanitized filename, and a UUID guarantees two uploads never collide.
  const path = `${rule.folder}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(String(body.filename || 'file'))}`;

  const { data, error } = await supabaseAdmin.storage
    .from(rule.bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[sign] createSignedUploadUrl failed:', error?.message);
    return NextResponse.json({ error: error?.message || 'Could not start upload' }, { status: 500 });
  }

  // `token` is what supabase-js's uploadToSignedUrl() needs on the browser.
  return NextResponse.json({ bucket: rule.bucket, path, token: data.token });
}
