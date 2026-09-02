import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

// Creates the RELEASE shell — title, artist, price, cover art. The tracks are
// uploaded one at a time afterwards via /api/store/tracks.
//
// Why split it: an album of 12 tracks at 40MB each is ~500MB. Pushing that
// through a single request is fragile (body limits, timeouts, and one dropped
// connection loses the whole upload). Creating the release first, then adding
// tracks one by one, means a failure costs you one track, not the album — and
// the browser can show real progress.

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE = 5 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = rateLimit(`store-release:${uploader.email}`, 20, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Cover is uploaded before the DB insert, so track it for rollback.
  let coverPath: string | null = null;

  try {
    const formData = await req.formData();
    const title = String(formData.get('title') || '').trim();
    const artist = String(formData.get('artist') || '').trim();
    const kind = String(formData.get('kind') || 'single');
    const description = String(formData.get('description') || '').trim();
    const price = parseFloat(String(formData.get('price')));
    const cover = formData.get('cover') as File | null;

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
    if (!cover) {
      return NextResponse.json({ error: 'Cover art is required' }, { status: 400 });
    }
    if (!ALLOWED_IMAGES.includes(cover.type) || cover.size > MAX_IMAGE) {
      return NextResponse.json(
        { error: `Invalid cover (JPG/PNG/WEBP, under 5MB). Got: ${cover.type}` },
        { status: 400 }
      );
    }

    coverPath = `release-covers/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(cover.name)}`;
    const { error: coverErr } = await supabaseAdmin.storage
      .from('beats-public')
      .upload(coverPath, cover, { contentType: cover.type, upsert: false });
    if (coverErr) throw coverErr;

    const { data: coverUrl } = supabaseAdmin.storage.from('beats-public').getPublicUrl(coverPath);

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
        cover_art: coverUrl.publicUrl,
        price,
        published: false, // stays hidden until the tracks are in and you publish
      })
      .select()
      .single();
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, release });
  } catch (err: any) {
    console.error('[Store] Release create error:', err.message);
    if (coverPath) {
      await supabaseAdmin.storage.from('beats-public').remove([coverPath]);
    }
    return NextResponse.json({ error: err.message || 'Could not create release' }, { status: 500 });
  }
}
