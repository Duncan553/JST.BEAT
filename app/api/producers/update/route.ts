import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import { verifyUploaded, publicUrl } from '@/lib/storage-verify';
import { revalidatePath } from 'next/cache';

// JSON only. If a new profile photo is being set, the browser has already put
// it in Storage itself (/api/uploads/sign) and sends just the path — files
// don't fit through Vercel's ~4.5MB request-body cap.

// youtube is the only field rendered as a raw `href` (the others always
// get concatenated onto a fixed https://... prefix, so they can't carry a
// scheme). React doesn't block `javascript:` hrefs on its own — reject
// anything that isn't a real http(s) link before it's ever stored.
function isSafeHttpUrl(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

// Self-service profile edit — a producer can only ever touch their OWN row
// (keyed by their verified email), never anyone else's.
export async function POST(req: NextRequest) {
  const uploader = await requireUploaderInfo(req);
  if (!uploader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = rateLimit(`producer-update:${uploader.email}`, 20, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const input = await req.json();
    const photoPath = input.photo_path ? String(input.photo_path) : null;
    const fullName = String(input.full_name || '').trim().slice(0, 100);
    const whatsapp = String(input.whatsapp || '').replace(/\D/g, '').slice(0, 15);
    const instagram = String(input.instagram || '').trim().replace(/^@/, '').slice(0, 40);
    const tiktok = String(input.tiktok || '').trim().replace(/^@/, '').slice(0, 40);
    const twitter = String(input.twitter || '').trim().replace(/^@/, '').slice(0, 40);
    const youtubeRaw = String(input.youtube || '').trim().slice(0, 200);
    if (youtubeRaw && !isSafeHttpUrl(youtubeRaw)) {
      return NextResponse.json({ error: 'YouTube link must be a valid http(s) URL' }, { status: 400 });
    }
    const youtube = youtubeRaw;

    const updates: Record<string, any> = {
      email: uploader.email,
      name: uploader.producer,
      full_name: fullName || null,
      whatsapp: whatsapp || null,
      instagram: instagram || null,
      tiktok: tiktok || null,
      twitter: twitter || null,
      youtube: youtube || null,
      updated_at: new Date().toISOString(),
    };

    // No photo_path means "keep the photo you already have".
    if (photoPath) {
      const photo = await verifyUploaded('producer-photo', photoPath);
      updates.photo_url = publicUrl(photo.bucket, photo.path);
    }

    const { data, error } = await supabaseAdmin
      .from('producers')
      .upsert(updates, { onConflict: 'email' })
      .select()
      .single();

    if (error) throw error;

    // /about is statically rendered with `revalidate = 3600`, so a saved
    // profile used to sit invisible for up to an hour — the page had no idea
    // anything changed. Purge it now, the moment the row is written.
    revalidatePath('/about');

    return NextResponse.json({ success: true, producer: data });
  } catch (err: any) {
    console.error('[Producers] Update error:', err.message);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
