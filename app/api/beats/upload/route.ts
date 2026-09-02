import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rateLimit } from '@/lib/rate-limit';
import { requireUploader } from '@/lib/auth-server';
import { createSnippet } from '@/lib/audio-tag';
import { getUsdToKes, usdToKes } from '@/lib/pricing';
import { verifyUploaded, publicUrl, rollbackOrphans } from '@/lib/storage-verify';
import { sanitizeFilename } from '@/lib/upload-kinds';
import crypto from 'crypto';

// FINALIZE step of a beat upload. The audio, cover and stems are ALREADY in
// Storage — the browser put them there itself using a token from
// /api/uploads/sign. All that arrives here is a small JSON body of paths.
//
// This route used to take the files as multipart. It could never work on
// Vercel: request bodies over ~4.5MB are rejected at the edge with a plain
// text 413 before the handler runs, and a real WAV is 30-40MB.

export const maxDuration = 300; // snippet encoding on a long WAV is not instant

export async function POST(req: NextRequest) {
  // Only jst.dan and tisco prodz may post beats — everything below this uses
  // the service-role client, which bypasses RLS entirely, so this check is the
  // ONLY thing standing between this route and the public.
  const producer = await requireUploader(req);
  if (!producer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!rateLimit(`upload:${ip}`, 10, 60 * 60 * 1000).success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // Everything this request is responsible for, so a failure can undo it.
  // Includes the client-uploaded objects: if the row never gets written they
  // are orphans nobody will ever find, and you pay to store them forever.
  const owned: Array<{ bucket: string; path: string }> = [];

  try {
    const body = await req.json();

    const title = String(body.title || '').trim();
    const bpm = parseInt(String(body.bpm), 10) || 0;
    const key = String(body.key || '').trim();
    const genre = String(body.genre || '').trim();
    // Beats are priced in USD. The legacy KES fields are still accepted so an
    // older client doesn't break, but USD is what gets stored as the truth.
    const price_usd_wav = parseFloat(String(body.price_usd_wav)) || 0;
    const price_usd_stems = parseFloat(String(body.price_usd_stems)) || 0;
    const price_wav = parseFloat(String(body.price_wav)) || 0;
    const price_stems = parseFloat(String(body.price_stems)) || 0;
    const tagsRaw = String(body.tags || '').trim();

    const audioPathIn = String(body.audio_path || '');
    const coverPathIn = String(body.cover_path || '');
    const snippetPathIn = body.snippet_path ? String(body.snippet_path) : null;
    const stemsPathIn = body.stems_path ? String(body.stems_path) : null;

    if (!title || !key || !genre || !audioPathIn || !coverPathIn) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (title.length > 120 || key.length > 10 || genre.length > 40) {
      return NextResponse.json({ error: 'Field too long' }, { status: 400 });
    }
    if (price_usd_wav <= 0 && price_wav <= 0) {
      return NextResponse.json({ error: 'WAV price must be greater than 0' }, { status: 400 });
    }

    // Confirm each uploaded object actually exists and obeys its rule. The
    // client picked the file, so the server re-checks type and size here —
    // this is the validation the old multipart route did on the File objects.
    const full = await verifyUploaded('beat-audio', audioPathIn);
    owned.push({ bucket: full.bucket, path: full.path });

    const cover = await verifyUploaded('beat-cover', coverPathIn);
    owned.push({ bucket: cover.bucket, path: cover.path });

    const stems = stemsPathIn ? await verifyUploaded('beat-stems', stemsPathIn) : null;
    if (stems) owned.push({ bucket: stems.bucket, path: stems.path });

    const snippetSrc = snippetPathIn ? await verifyUploaded('beat-snippet', snippetPathIn) : null;
    if (snippetSrc) owned.push({ bucket: snippetSrc.bucket, path: snippetSrc.path });

    // Build the PUBLIC preview. The producer's own clip is used if they gave
    // one, otherwise the full track is auto-trimmed — either way it gets the
    // tag mixed in and is capped (see lib/audio-tag.ts). The private copy is
    // never touched: that untagged master is what the buyer is paying for.
    const source = snippetSrc ?? full;
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from(source.bucket).download(source.path);
    if (dlErr || !blob) throw new Error(`Could not read the uploaded audio back: ${dlErr?.message}`);

    const srcName = sanitizeFilename(source.path.split('/').pop() || 'beat.mp3');
    const snippetBuffer = await createSnippet(Buffer.from(await blob.arrayBuffer()), srcName, producer);

    const snippetPath = `beats/${Date.now()}-${crypto.randomUUID()}-${srcName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from('beats-public')
      .upload(snippetPath, snippetBuffer, { contentType: full.type || 'audio/mpeg', upsert: false });
    if (upErr) throw upErr;
    owned.push({ bucket: 'beats-public', path: snippetPath });

    const tags = tagsRaw
      ? tagsRaw.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0 && t.length <= 30)
      : [];

    // KES is derived from USD at request time, never stored as a second source
    // of truth. The legacy price_wav/price_stems columns get a snapshot only so
    // older read paths keep working.
    const { rate } = await getUsdToKes();
    const usdWav = price_usd_wav > 0 ? price_usd_wav : price_wav / rate;
    const usdStems = price_usd_stems > 0 ? price_usd_stems : price_stems / rate;

    const beatData: any = {
      title, bpm, key, genre, producer,
      cover_art: publicUrl(cover.bucket, cover.path),
      snippet_url: publicUrl('beats-public', snippetPath),
      full_url: publicUrl(full.bucket, full.path),
      price_usd_wav: Number(usdWav.toFixed(2)),
      price_usd_stems: Number(usdStems.toFixed(2)),
      price_wav: usdToKes(usdWav, rate),
      price_stems: usdStems > 0 ? usdToKes(usdStems, rate) : 0,
      tags,
    };
    if (stems) beatData.stems_url = publicUrl(stems.bucket, stems.path);

    const { data: inserted, error: dbErr } = await supabaseAdmin
      .from('beats').insert(beatData).select().single();
    if (dbErr) throw dbErr;

    // The producer's raw clip was only ever an ingredient for the tagged
    // preview — nothing references it, so don't keep paying to store it.
    if (snippetSrc) {
      await supabaseAdmin.storage.from(snippetSrc.bucket).remove([snippetSrc.path]);
    }

    return NextResponse.json({ success: true, beat: inserted });
  } catch (err: any) {
    console.error('Upload error:', err.message);
    // Undo anything this upload put in storage, but never a file a live row
    // still points at (see rollbackOrphans).
    await rollbackOrphans(owned);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
