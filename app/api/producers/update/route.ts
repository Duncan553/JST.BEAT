import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUploaderInfo } from '@/lib/auth-server';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_PHOTO = 5 * 1024 * 1024; // 5MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

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
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const fullName = String(formData.get('full_name') || '').trim().slice(0, 100);
    const whatsapp = String(formData.get('whatsapp') || '').replace(/\D/g, '').slice(0, 15);
    const instagram = String(formData.get('instagram') || '').trim().replace(/^@/, '').slice(0, 40);
    const tiktok = String(formData.get('tiktok') || '').trim().replace(/^@/, '').slice(0, 40);
    const twitter = String(formData.get('twitter') || '').trim().replace(/^@/, '').slice(0, 40);
    const youtubeRaw = String(formData.get('youtube') || '').trim().slice(0, 200);
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

    if (photo && photo.size > 0) {
      if (!ALLOWED_IMAGES.includes(photo.type) || photo.size > MAX_PHOTO) {
        return NextResponse.json(
          { error: `Invalid photo (must be JPG/PNG/WEBP, under 5MB). Got: ${photo.type}` },
          { status: 400 }
        );
      }
      const path = `producer-photos/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(photo.name)}`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('beats-public')
        .upload(path, photo, { contentType: photo.type, upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabaseAdmin.storage.from('beats-public').getPublicUrl(path);
      updates.photo_url = urlData.publicUrl;
    }

    const { data, error } = await supabaseAdmin
      .from('producers')
      .upsert(updates, { onConflict: 'email' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, producer: data });
  } catch (err: any) {
    console.error('[Producers] Update error:', err.message);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}
