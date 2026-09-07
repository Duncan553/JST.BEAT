#!/usr/bin/env node
/**
 * BACKFILL: re-encode every public audio copy to AAC 128k, normalised to
 * -14 LUFS — the same pipeline lib/audio-tag.ts now applies to new uploads.
 *
 * Changing the encoder only affects files uploaded AFTER the change. Everything
 * already in storage keeps whatever it was made with, which today means beat
 * snippets are raw WAV (~20MB for a two-minute preview) and loudness across the
 * catalogue spans about 7 dB. This script fixes what is already there.
 *
 * WHERE EACH FILE IS RE-ENCODED FROM — this is the part that matters:
 *
 *   beat snippets  → from the existing public snippet. It is WAV (lossless) and
 *                    already trimmed and tagged, so re-encoding it loses nothing
 *                    and preserves the trim.
 *   store streams  → from the PRIVATE MASTER, never from the public MP3. The
 *                    public stream is 128k, so encoding AAC from it would stack
 *                    a second generation of artefacts on the worst available
 *                    source. The master is always the better one.
 *
 *                    CAVEAT, found by running this: the masters are NOT all
 *                    WAV. On this catalogue 13 of 30 were themselves MP3s, so
 *                    for those the output IS second-generation — there is just
 *                    no cleaner source in the system. The fix for that is not
 *                    in this script: it is re-uploading real masters, which
 *                    also matters because those files are what a paying
 *                    customer downloads.
 *
 * SAFETY
 *   - Dry run by default. Pass --apply to write anything.
 *   - The DB row is repointed BEFORE the old object is deleted, and the delete
 *     only happens once the update is confirmed — never orphan a live row.
 *   - Old objects are kept unless --delete-old is passed. Storage is cheap;
 *     an unrecoverable master is not.
 *
 * Usage:
 *   node --env-file=.env.local scripts/renormalize-audio.mjs            # dry run
 *   node --env-file=.env.local scripts/renormalize-audio.mjs --apply
 *   node --env-file=.env.local scripts/renormalize-audio.mjs --apply --delete-old
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const FFMPEG = require('ffmpeg-static');

const APPLY = process.argv.includes('--apply');
const DELETE_OLD = process.argv.includes('--delete-old');
// Dry run does NOT download anything by default. Pulling every master to
// measure it costs real egress — this Supabase project is on the free tier, and
// 30 album masters is over a gigabyte for a report nobody asked to pay for.
// A HEAD request gives the size and the current format, which is the whole plan.
// --sample N downloads the first N and measures them properly.
const SAMPLE = (() => {
  const i = process.argv.indexOf('--sample');
  return i === -1 ? 0 : parseInt(process.argv[i + 1] || '1', 10);
})();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run with:  node --env-file=.env.local scripts/renormalize-audio.mjs');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const LUFS = -14, TP = -1.5, LRA = 11;   // Spotify's playback target
const TMP = os.tmpdir();

/**
 * Storage is over the network and the network is not reliable: a real run of
 * this script died on file 32 of 33 with a Cloudflare 520 from Supabase
 * Storage, which is a transient upstream hiccup and not something the caller
 * did wrong. Retry the request rather than throwing away 31 files of work.
 */
async function withRetry(label, fn, attempts = 4) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i === attempts) break;
      const waitMs = 1000 * 2 ** (i - 1);   // 1s, 2s, 4s
      console.log(`  [retry ${i}/${attempts - 1}] ${label}: ${String(e.message).slice(0, 80)} — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

const run = (args) => new Promise((resolve, reject) => {
  const p = spawn(FFMPEG, args);
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(err.slice(-400)))));
});

/** Pass 1 — measure only. Returns null if it cannot be measured. */
async function measure(file) {
  try {
    const err = await run(['-i', file, '-af',
      `loudnorm=I=${LUFS}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '/dev/null']);
    const blocks = err.match(/\{[^{}]*\}/g);
    if (!blocks) return null;
    const j = JSON.parse(blocks[blocks.length - 1]);
    return j?.input_i ? j : null;
  } catch { return null; }
}

/** Pass 2 — encode with the measured numbers applied as a fixed gain. */
async function encode(inFile, outFile, stats) {
  const base = `loudnorm=I=${LUFS}:TP=${TP}:LRA=${LRA}`;
  const filter = stats
    ? `${base}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}` +
      `:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}` +
      `:offset=${stats.target_offset}:linear=true`
    : base;
  await run(['-i', inFile, '-af', filter, '-c:a', 'aac', '-b:a', '128k',
    '-ar', '44100', '-ac', '2', '-movflags', '+faststart', outFile, '-y']);
}

const storagePathFromUrl = (url) => {
  const m = url?.match(/\/object\/(?:public|sign)\/([^/]+)\/(.+?)(\?|$)/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
};

async function download(url, dest) {
  await withRetry('download', async () => {
    const res = await fetch(url, { headers: H });
    if (!res.ok) throw new Error(`download ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  });
}

/** Private objects need the authenticated endpoint, not the public URL. */
const signedDownloadUrl = (bucket, p) =>
  `${URL_BASE}/storage/v1/object/${bucket}/${p}`;

async function upload(bucket, p, buf) {
  return withRetry('upload', async () => {
    const res = await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${p}`, {
      method: 'POST',
      // upsert on, so a retry after a half-failed upload overwrites its own
      // partial object instead of colliding with it.
      headers: { ...H, 'Content-Type': 'audio/mp4', 'x-upsert': 'true' },
      body: buf,
    });
    if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return `${URL_BASE}/storage/v1/object/public/${bucket}/${p}`;
  });
}

async function patchRow(table, id, snippet_url) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ snippet_url }),
  });
  const rows = await res.json();
  // RLS-blocked writes return 0 rows with no error — always check the count.
  if (!res.ok || !Array.isArray(rows) || rows.length === 0) {
    throw new Error(`row update wrote 0 rows: ${JSON.stringify(rows).slice(0, 200)}`);
  }
}

async function removeObject(bucket, p) {
  await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${p}`, { method: 'DELETE', headers: H });
}

/** Size + type without pulling the body. Costs one request, no egress. */
async function inspect(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: H });
    return {
      bytes: Number(res.headers.get('content-length') || 0),
      type: res.headers.get('content-type') || '?',
    };
  } catch { return { bytes: 0, type: '?' }; }
}

async function processOne({ table, id, title, sourceUrl, sourceIsPrivate, currentUrl, measureThis }) {
  // Cheap path: report the plan from headers alone.
  if (!APPLY && !measureThis) {
    const cur = await inspect(currentUrl);
    const already = /mp4|m4a|aac/.test(cur.type);
    console.log(`  [dry] ${title.slice(0, 30).padEnd(32)} ${(cur.bytes / 1048576).toFixed(2)}MB  ${cur.type}` +
      (already ? '  (already AAC)' : '  -> AAC 128k @ -14 LUFS'));
    return;
  }
  const uid = crypto.randomUUID();
  const inF = path.join(TMP, `${uid}-in`);
  const outF = path.join(TMP, `${uid}-out.m4a`);
  try {
    await download(sourceIsPrivate ? sourceUrl : sourceUrl, inF);
    const before = fs.statSync(inF).size;
    const stats = await measure(inF);
    await encode(inF, outF, stats);
    const after = fs.statSync(outF).size;
    const outStats = await measure(outF);

    const line = `${title.slice(0, 30).padEnd(32)} ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB   ` +
      `${stats ? Number(stats.input_i).toFixed(1) : '  ?'} -> ${outStats ? Number(outStats.input_i).toFixed(1) : '  ?'} LUFS`;

    if (!APPLY) { console.log('  [dry+measured] ' + line); return; }

    const old = storagePathFromUrl(currentUrl);
    const newPath = `${old.path.replace(/\.[^.]+$/, '')}.m4a`;
    const publicUrl = await upload(old.bucket, newPath, fs.readFileSync(outF));
    // Repoint the row FIRST; only then is the old object unreferenced.
    await patchRow(table, id, publicUrl);
    if (DELETE_OLD) await removeObject(old.bucket, old.path);
    console.log('  [ok ] ' + line);
  } finally {
    fs.rmSync(inF, { force: true });
    fs.rmSync(outF, { force: true });
  }
}

// A batch of 33 should not be abandoned because one of them failed. Record the
// failure, carry on, and report at the end — the run is resumable anyway, since
// anything already .m4a is skipped.
const failures = [];
async function safely(title, fn) {
  try { await fn(); } catch (e) {
    failures.push([title, String(e.message).slice(0, 120)]);
    console.log(`  [FAIL] ${title}: ${String(e.message).slice(0, 100)}`);
  }
}

(async () => {
  console.log(APPLY ? '=== APPLYING ===' : `=== DRY RUN — no writes, no downloads${SAMPLE ? ` (measuring first ${SAMPLE})` : ''} ===`);
  let done = 0;

  const beats = await (await fetch(`${URL_BASE}/rest/v1/beats?select=id,title,snippet_url`, { headers: H })).json();
  console.log(`\nBEAT SNIPPETS (${beats.length}) — re-encoded from the existing WAV snippet:`);
  for (const b of beats) {
    if (!b.snippet_url) continue;
    if (b.snippet_url.endsWith('.m4a')) { console.log(`  [skip] ${b.title} already .m4a`); continue; }
    await safely(b.title, () => processOne({ table: 'beats', id: b.id, title: b.title,
      sourceUrl: b.snippet_url, currentUrl: b.snippet_url, measureThis: done++ < SAMPLE }));
  }

  const tracks = await (await fetch(`${URL_BASE}/rest/v1/tracks?select=id,title,snippet_url,full_url`, { headers: H })).json();
  console.log(`\nSTORE STREAMS (${tracks.length}) — re-encoded from the PRIVATE MASTER, not the MP3:`);
  for (const t of tracks) {
    if (!t.snippet_url) continue;
    if (t.snippet_url.endsWith('.m4a')) { console.log(`  [skip] ${t.title} already .m4a`); continue; }
    const master = storagePathFromUrl(t.full_url);
    if (!master) { console.log(`  [warn] ${t.title}: no master found, skipping rather than stacking a second lossy encode`); continue; }
    await safely(t.title, () => processOne({
      table: 'tracks', id: t.id, title: t.title,
      sourceUrl: signedDownloadUrl(master.bucket, master.path),
      sourceIsPrivate: true,
      currentUrl: t.snippet_url,
      measureThis: done++ < SAMPLE,
    }));
  }
  if (failures.length) {
    console.log(`\n${failures.length} FAILED — re-run to retry just these (converted files are skipped):`);
    failures.forEach(([t, e]) => console.log(`  ${t}: ${e}`));
  }
  console.log(APPLY ? '\nDone.' : '\nNothing written. Re-run with --apply.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
