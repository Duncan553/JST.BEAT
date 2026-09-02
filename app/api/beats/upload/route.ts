import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { requireUploader } from '@/lib/auth-server';
import { createSnippet } from '@/lib/audio-tag';
import { getUsdToKes, usdToKes } from '@/lib/pricing';
import crypto from 'crypto';

const ALLOWED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3', 'audio/wave'];
const ALLOWED_IMAGES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const ALLOWED_ZIP = ['application/zip', 'application/x-zip-compressed'];
const MAX_AUDIO = 50 * 1024 * 1024;      // 50MB — a full WAV track can easily be 30-40MB+
const MAX_IMAGE = 5 * 1024 * 1024;       // 5MB
const MAX_STEMS = 50 * 1024 * 1024;      // 50MB for ZIP

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/_{2,}/g, '_');
}

export async function POST(req: NextRequest) {
  // Only jst.dan and tisco prodz may post beats — everything below this
  // uses the service-role client, which bypasses RLS entirely, so this
  // check is the ONLY thing standing between this route and the public.
  const producer = await requireUploader(req);
  if (!producer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 10 uploads per IP per hour
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const limit = rateLimit(`upload:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Declared out here so the catch block below can roll these back.
  const written: Array<{ bucket: string; path: string }> = [];

  try {
    const formData = await req.formData();
    const title = String(formData.get('title') || '').trim();
    const bpm = parseInt(String(formData.get('bpm')), 10) || 0;
    const key = String(formData.get('key') || '').trim();
    const genre = String(formData.get('genre') || '').trim();
    // Beats are priced in USD. The legacy KES fields are still accepted so an
    // older client doesn't break, but USD is what gets stored as the truth.
    const price_usd_wav = parseFloat(String(formData.get('price_usd_wav'))) || 0;
    const price_usd_stems = parseFloat(String(formData.get('price_usd_stems'))) || 0;
    const price_wav = parseFloat(String(formData.get('price_wav'))) || 0;
    const price_stems = parseFloat(String(formData.get('price_stems'))) || 0;
    const tagsRaw = String(formData.get('tags') || '').trim();
    const audio = formData.get('audio') as File | null;
    const snippetFile = formData.get('snippet') as File | null;
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
      return NextResponse.json({ error: `Invalid audio file (must be MP3/WAV, under 50MB). Got: ${audio.type}` }, { status: 400 });
    }
    // Tagged snippet is optional — if they don't upload one, we auto-trim
    // the full track instead, both capped the same way (see lib/audio-tag.ts).
    if (snippetFile && (!ALLOWED_AUDIO.includes(snippetFile.type) || snippetFile.size > MAX_AUDIO)) {
      console.error(`[Upload] Rejected snippet: type="${snippetFile.type}", size=${snippetFile.size}`);
      return NextResponse.json({ error: `Invalid snippet file (must be MP3/WAV, under 50MB). Got: ${snippetFile.type}` }, { status: 400 });
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

    // A WAV price is required in one currency or the other.
    if (price_usd_wav <= 0 && price_wav <= 0) {
      return NextResponse.json({ error: 'WAV price must be greater than 0' }, { status: 400 });
    }

    // Sanitized filenames
    const safeAudioName = sanitizeFilename(audio.name);
    const safeCoverName = sanitizeFilename(cover.name);
    const audioPath = `beats/${Date.now()}-${crypto.randomUUID()}-${safeAudioName}`;
    const coverPath = `covers/${Date.now()}-${crypto.randomUUID()}-${safeCoverName}`;
    const fullPath = `full/${Date.now()}-${crypto.randomUUID()}-${safeAudioName}`;

    // Preview copy gets the producer tag mixed in (protects it from being
    // ripped and resold as the full track); the full/private copies below
    // stay untouched originals — that's what the buyer is actually paying
    // for. If they uploaded their own snippet clip, that's what plays —
    // otherwise it falls back to auto-trimming the first 45s of the track.
    const snippet = snippetFile
      ? await createSnippet(Buffer.from(await snippetFile.arrayBuffer()), sanitizeFilename(snippetFile.name), producer)
      : await createSnippet(Buffer.from(await audio.arrayBuffer()), safeAudioName, producer);

    // Uploads one file and records it, so a later failure can undo it.
    const put = async (bucket: string, path: string, body: Blob | Buffer, contentType: string) => {
      const { error } = await supabaseAdmin.storage
        .from(bucket).upload(path, body, { contentType, upsert: false });
      if (error) throw error;
      written.push({ bucket, path });
    };

    // Upload preview to PUBLIC bucket
    await put('beats-public', audioPath, snippet, audio.type);

    // Upload cover to PUBLIC bucket
    await put('beats-public', coverPath, cover, cover.type);

    // Upload FULL beat to PRIVATE bucket
    await put('beats-private', fullPath, audio, audio.type);

    // Upload stems ZIP to PRIVATE bucket (optional)
    let stemsUrl: string | null = null;
    if (stemsZip) {
      const safeStemsName = sanitizeFilename(stemsZip.name);
      const stemsPath = `stems/${Date.now()}-${crypto.randomUUID()}-${safeStemsName}`;
      await put('beats-private', stemsPath, stemsZip, stemsZip.type);

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

    // KES is derived from USD at request time, never stored as a second
    // source of truth. The legacy price_wav/price_stems columns are filled
    // with a snapshot only so older read paths keep working.
    const { rate } = await getUsdToKes();
    const usdWav = price_usd_wav > 0 ? price_usd_wav : price_wav / rate;
    const usdStems = price_usd_stems > 0 ? price_usd_stems : price_stems / rate;

    const beatData: any = {
      title, bpm, key, genre, producer,
      cover_art: coverUrl.publicUrl,
      snippet_url: audioUrl.publicUrl,
      full_url: fullUrl.publicUrl,
      price_usd_wav: Number(usdWav.toFixed(2)),
      price_usd_stems: Number(usdStems.toFixed(2)),
      price_wav: usdToKes(usdWav, rate),
      price_stems: usdStems > 0 ? usdToKes(usdStems, rate) : 0,
      tags,
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

    // Roll back anything already in storage. A half-finished upload used to
    // leave the audio, cover, full track and stems behind with no DB row
    // pointing at them — invisible junk you keep paying to store.
    for (const { bucket, path } of written) {
      const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
      if (error) console.error(`[Upload] Could not roll back ${bucket}/${path}:`, error.message);
    }

    // Send the real reason back. This used to be a flat "Upload failed",
    // which is why a missing `producer` column looked like a mystery for
    // weeks — the actual error never left the server.
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
