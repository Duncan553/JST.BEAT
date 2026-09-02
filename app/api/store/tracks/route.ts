import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { createStreamCopy } from '@/lib/audio-tag';
import crypto from 'crypto';

// Adds ONE track to an existing release. The dashboard calls this in a loop,
// once per file, so a 12-track album is 12 small requests instead of one
// enormous one. See the note in ../releases/route.ts.

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/wave'];
const MAX_AUDIO = 50 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = rateLimit(`store-track:${uploader.email}`, 200, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const written: Array<{ bucket: string; path: string }> = [];

  try {
    const formData = await req.formData();
    const releaseId = String(formData.get('release_id') || '');
    const title = String(formData.get('title') || '').trim();
    const trackNumber = parseInt(String(formData.get('track_number')), 10);
    const audio = formData.get('audio') as File | null;

    if (!releaseId || !title || !audio) {
      return NextResponse.json({ error: 'release_id, title and audio are required' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Track title is too long' }, { status: 400 });
    }
    if (!Number.isFinite(trackNumber) || trackNumber < 1) {
      return NextResponse.json({ error: 'track_number must be 1 or greater' }, { status: 400 });
    }
    if (!ALLOWED_AUDIO.includes(audio.type) || audio.size > MAX_AUDIO) {
      return NextResponse.json(
        { error: `Invalid audio (MP3/WAV, under 50MB). Got: ${audio.type || 'unknown type'}` },
        { status: 400 }
      );
    }

    // You may only add tracks to YOUR OWN release. Without this check, either
    // producer could bolt tracks onto the other's album — and since `producer`
    // on the release decides who gets paid, that is a money bug, not just an
    // access one.
    const { data: release, error: relErr } = await supabaseAdmin
      .from('releases')
      .select('id, producer')
      .eq('id', releaseId)
      .single();
    if (relErr || !release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }
    if (release.producer !== uploader.producer) {
      return NextResponse.json({ error: 'That release belongs to another producer' }, { status: 403 });
    }

    const safeName = sanitizeFilename(audio.name);
    const audioBuffer = Buffer.from(await audio.arrayBuffer());

    // Public stream: the WHOLE song at 128kbps, untagged. Free to play, but
    // it is not the master — that stays private and is what the buyer pays for.
    const snippet = await createStreamCopy(audioBuffer, safeName);
    const snippetPath = `release-previews/${Date.now()}-${crypto.randomUUID()}-${safeName.replace(/\.[^.]+$/, '')}.mp3`;
    const { error: snipErr } = await supabaseAdmin.storage
      .from('beats-public')
      .upload(snippetPath, snippet, { contentType: 'audio/mpeg', upsert: false });
    if (snipErr) throw snipErr;
    written.push({ bucket: 'beats-public', path: snippetPath });

    // The real file — private bucket, only ever handed out as a signed URL
    // by /api/orders/download once the order is actually paid.
    const fullPath = `release-tracks/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error: fullErr } = await supabaseAdmin.storage
      .from('beats-private')
      .upload(fullPath, audio, { contentType: audio.type, upsert: false });
    if (fullErr) throw fullErr;
    written.push({ bucket: 'beats-private', path: fullPath });

    const { data: snippetUrl } = supabaseAdmin.storage.from('beats-public').getPublicUrl(snippetPath);
    const { data: fullUrl } = supabaseAdmin.storage.from('beats-private').getPublicUrl(fullPath);

    const { data: track, error: dbErr } = await supabaseAdmin
      .from('tracks')
      .insert({
        release_id: releaseId,
        title,
        track_number: trackNumber,
        snippet_url: snippetUrl.publicUrl,
        full_url: fullUrl.publicUrl,
      })
      .select('id, title, track_number, snippet_url')
      .single();

    // 23505 = unique_violation, i.e. that track number is already taken on
    // this release. That's a normal thing for a user to do, not a server
    // fault — answer it plainly instead of leaking the constraint name.
    if (dbErr?.code === '23505') {
      for (const { bucket, path } of written) {
        await supabaseAdmin.storage.from(bucket).remove([path]);
      }
      return NextResponse.json(
        { error: `Track ${trackNumber} already exists on this release` },
        { status: 409 }
      );
    }
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, track });
  } catch (err: any) {
    console.error('[Store] Track upload error:', err.message);
    // Don't leave half-uploaded audio behind if the insert fails.
    for (const { bucket, path } of written) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
      if (error) console.error(`[Store] Rollback failed for ${bucket}/${path}:`, error.message);
    }
    return NextResponse.json({ error: err.message || 'Track upload failed' }, { status: 500 });
  }
}
