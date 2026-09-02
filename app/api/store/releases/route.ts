import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { verifyUploaded, publicUrl, rollbackOrphans } from '@/lib/storage-verify';

// Creates the RELEASE shell — title, artist, price, cover art. The tracks are
// uploaded one at a time afterwards via /api/store/tracks.
//
// Why split it: an album of 12 tracks at 40MB each is ~500MB. Pushing that
// through a single request is fragile (body limits, timeouts, and one dropped
// connection loses the whole upload). Creating the release first, then adding
// tracks one by one, means a failure costs you one track, not the album — and
// the browser can show real progress.

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = rateLimit(`store-release:${uploader.email}`, 20, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // The cover is already in Storage (the browser put it there via
  // /api/uploads/sign) — track it so a failed insert doesn't orphan it.
  const owned: Array<{ bucket: string; path: string }> = [];

  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const artist = String(body.artist || '').trim();
    const kind = String(body.kind || 'single');
    const description = String(body.description || '').trim();
    const price = parseFloat(String(body.price));
    const coverPathIn = String(body.cover_path || '');

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (title.length > 200 || artist.length > 200) {
      return NextResponse.json({ error: 'Title or artist name is too long' }, { status: 400 });
    }
    if (!['single', 'album'].includes(kind)) {
      return NextResponse.json({ error: 'Kind must be "single" or "album"' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Price must be greater than 0' }, { status: 400 });
    }
    if (!coverPathIn) {
      return NextResponse.json({ error: 'Cover art is required' }, { status: 400 });
    }

    // Re-check the stored object: the browser chose the file, so type and size
    // are still the server's call.
    const cover = await verifyUploaded('store-cover', coverPathIn);
    owned.push({ bucket: cover.bucket, path: cover.path });

    // `producer` comes from the verified session, never from the form — it is
    // what routes the money, so the browser must not get a vote.
    const { data: release, error: dbErr } = await supabaseAdmin
      .from('releases')
      .insert({
        producer: uploader.producer,
        artist: artist || null,
        kind,
        title,
        description: description || null,
        cover_art: publicUrl(cover.bucket, cover.path),
        price,
        published: false, // stays hidden until the tracks are in and you publish
      })
      .select()
      .single();
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, release });
  } catch (err: any) {
    console.error('[Store] Release create error:', err.message);
    await rollbackOrphans(owned);
    return NextResponse.json({ error: err.message || 'Could not create release' }, { status: 500 });
  }
}
