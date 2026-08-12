import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/wave'];
const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const ALLOWED_ZIP = ['application/zip', 'application/x-zip-compressed'];
const MAX_AUDIO = 20 * 1024 * 1024;      // 20MB
const MAX_IMAGE = 5 * 1024 * 1024;       // 5MB
const MAX_STEMS = 50 * 1024 * 1024;      // 50MB for ZIP

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 uploads per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const limit = rateLimit(`upload:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const title = String(formData.get('title') || '').trim();
    const bpm = parseInt(String(formData.get('bpm')), 10) || 0;
    const key = String(formData.get('key') || '').trim();
    const genre = String(formData.get('genre') || '').trim();
    const price_wav = parseFloat(String(formData.get('price_wav'))) || 0;
    const price_stems = parseFloat(String(formData.get('price_stems'))) || 0;
    const tagsRaw = String(formData.get('tags') || '').trim();
    const audio = formData.get('audio') as File | null;
    const cover = formData.get('cover') as File | null;
    const stemsZip = formData.get('stems') as File | null;

    // Validation
    if (!title || !key || !genre || !audio || !cover) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (title.length > 120 || key.length > 10 || genre.length > 40) {
      return NextResponse.json({ error: 'Field too long' }, { status: 400 });
    }
    if (!ALLOWED_AUDIO.includes(audio.type) || audio.size > MAX_AUDIO) {
      console.error(`[Upload] Rejected audio: type="${audio.type}", size=${audio.size}`);
      return NextResponse.json({ error: `Invalid audio file (must be MP3/WAV, under 20MB). Got: ${audio.type}` }, { status: 400 });
    }
    if (!ALLOWED_IMAGES.includes(cover.type) || cover.size > MAX_IMAGE) {
      console.error(`[Upload] Rejected image: type="${cover.type}", size=${cover.size}`);
      return NextResponse.json({ error: `Invalid cover image (must be JPG/PNG/WEBP, under 5MB). Got: ${cover.type}` }, { status: 400 });
    }

    // Stems ZIP is optional, but if provided must be valid
    if (stemsZip) {
      if (!ALLOWED_ZIP.includes(stemsZip.type) || stemsZip.size > MAX_STEMS) {
        console.error(`[Upload] Rejected stems: type="${stemsZip.type}", size=${stemsZip.size}`);
        return NextResponse.json({ error: `Invalid stems file (must be ZIP, under 50MB). Got: ${stemsZip.type}` }, { status: 400 });
      }
    }

    // WAV price is required — must be > 0
    if (!Number.isFinite(price_wav) || price_wav <= 0) {
      return NextResponse.json({ error: 'WAV price must be greater than 0' }, { status: 400 });
    }

    // Sanitized filenames
    const safeAudioName = sanitizeFilename(audio.name);
    const safeCoverName = sanitizeFilename(cover.name);
    const audioPath = `beats/${Date.now()}-${crypto.randomUUID()}-${safeAudioName}`;
    const coverPath = `covers/${Date.now()}-${crypto.randomUUID()}-${safeCoverName}`;
    const fullPath = `full/${Date.now()}-${crypto.randomUUID()}-${safeAudioName}`;

    // Upload preview to PUBLIC bucket
    const { error: audioErr } = await supabaseAdmin.storage
      .from('beats-public').upload(audioPath, audio, { contentType: audio.type, upsert: false });
    if (audioErr) throw audioErr;

    // Upload cover to PUBLIC bucket
    const { error: coverErr } = await supabaseAdmin.storage
      .from('beats-public').upload(coverPath, cover, { contentType: cover.type, upsert: false });
    if (coverErr) throw coverErr;

    // Upload FULL beat to PRIVATE bucket
    const { error: fullErr } = await supabaseAdmin.storage
      .from('beats-private').upload(fullPath, audio, { contentType: audio.type, upsert: false });
    if (fullErr) throw fullErr;

    // Upload stems ZIP to PRIVATE bucket (optional)
    let stemsUrl: string | null = null;
    if (stemsZip) {
      const safeStemsName = sanitizeFilename(stemsZip.name);
      const stemsPath = `stems/${Date.now()}-${crypto.randomUUID()}-${safeStemsName}`;
      const { error: stemsErr } = await supabaseAdmin.storage
        .from('beats-private').upload(stemsPath, stemsZip, { contentType: stemsZip.type, upsert: false });
      if (stemsErr) throw stemsErr;
      
      const { data: stemsData } = supabaseAdmin.storage.from('beats-private').getPublicUrl(stemsPath);
      stemsUrl = stemsData.publicUrl;
    }

    // Get URLs
    const { data: audioUrl } = supabaseAdmin.storage.from('beats-public').getPublicUrl(audioPath);
    const { data: coverUrl } = supabaseAdmin.storage.from('beats-public').getPublicUrl(coverPath);
    const { data: fullUrl } = supabaseAdmin.storage.from('beats-private').getPublicUrl(fullPath);

    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 30)
      : [];

    const beatData: any = {
      title, bpm, key, genre,
      cover_art: coverUrl.publicUrl,
      snippet_url: audioUrl.publicUrl,
      full_url: fullUrl.publicUrl,
      price_wav, price_stems, tags,
    };

    // Only add stems_url if a ZIP was uploaded
    if (stemsUrl) {
      beatData.stems_url = stemsUrl;
    }

    const { data: inserted, error: dbErr } = await supabaseAdmin
      .from('beats').insert(beatData).select().single();
    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, beat: inserted });
  } catch (err: any) {
    console.error('Upload error:', err.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
