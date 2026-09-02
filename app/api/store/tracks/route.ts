import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { createStreamCopy } from '@/lib/audio-tag';
import { verifyUploaded, publicUrl, rollbackOrphans } from '@/lib/storage-verify';
import { sanitizeFilename } from '@/lib/upload-kinds';
import crypto from 'crypto';

// Adds ONE track to an existing release. The dashboard calls this in a loop,
// once per file, so a 12-track album is 12 small requests instead of one
// enormous one. See the note in ../releases/route.ts.

// The master itself never passes through this route: the browser uploads it
// straight to Storage (see /api/uploads/sign) because Vercel kills any request
// body over ~4.5MB, and one track is 9-40MB. We only get told where it landed.
export const maxDuration = 300; // transcoding the free stream copy takes a while

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = rateLimit(`store-track:${uploader.email}`, 200, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const owned: Array<{ bucket: string; path: string }> = [];

  try {
    const body = await req.json();
    const releaseId = String(body.release_id || '');
    const title = String(body.title || '').trim();
    const trackNumber = parseInt(String(body.track_number), 10);
    const audioPathIn = String(body.audio_path || '');

    if (!releaseId || !title || !audioPathIn) {
      return NextResponse.json({ error: 'release_id, title and audio_path are required' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: 'Track title is too long' }, { status: 400 });
    }
    if (!Number.isFinite(trackNumber) || trackNumber < 1) {
      return NextResponse.json({ error: 'track_number must be 1 or greater' }, { status: 400 });
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

    // The master is already in the private bucket — confirm it's really there
    // and really audio before anything references it.
    const master = await verifyUploaded('store-audio', audioPathIn);
    owned.push({ bucket: master.bucket, path: master.path });

    const safeName = sanitizeFilename(master.path.split('/').pop() || 'track.mp3');
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(master.bucket).download(master.path);
    if (dlErr || !blob) throw new Error(`Could not read the uploaded track back: ${dlErr?.message}`);
    const audioBuffer = Buffer.from(await blob.arrayBuffer());

    // Public stream: the WHOLE song at 128kbps, untagged. Free to play, but
    // it is not the master — that stays private and is what the buyer pays for.
    const snippet = await createStreamCopy(audioBuffer, safeName);
    const snippetPath = `release-previews/${Date.now()}-${crypto.randomUUID()}-${safeName.replace(/\.[^.]+$/, '')}.mp3`;
    const { error: snipErr } = await supabaseAdmin.storage
      .from('beats-public')
      .upload(snippetPath, snippet, { contentType: 'audio/mpeg', upsert: false });
    if (snipErr) throw snipErr;
    owned.push({ bucket: 'beats-public', path: snippetPath });

    const { data: track, error: dbErr } = await supabaseAdmin
      .from('tracks')
      .insert({
        release_id: releaseId,
        title,
        track_number: trackNumber,
        snippet_url: publicUrl('beats-public', snippetPath),
        // The master stays private, handed out only as a signed URL by
        // /api/orders/download once the order is actually paid.
        full_url: publicUrl(master.bucket, master.path),
      })
      .select('id, title, track_number, snippet_url')
      .single();

    // 23505 = unique_violation, i.e. that track number is already taken on
    // this release. That's a normal thing for a user to do, not a server
    // fault — answer it plainly instead of leaking the constraint name.
    if (dbErr?.code === '23505') {
      await rollbackOrphans(owned);
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
    await rollbackOrphans(owned);
    return NextResponse.json({ error: err.message || 'Track upload failed' }, { status: 500 });
  }
}
