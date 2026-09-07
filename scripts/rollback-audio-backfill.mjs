#!/usr/bin/env node
/**
 * Undo scripts/renormalize-audio.mjs by restoring the snippet_url values from a
 * snapshot taken before it ran.
 *
 * This works ONLY because the backfill is run without --delete-old, so the
 * original objects are still in storage and the old URLs still resolve. If you
 * ever pass --delete-old, take a fresh snapshot first and understand that this
 * script can no longer save you.
 *
 * Usage:
 *   node --env-file=.env.local scripts/rollback-audio-backfill.mjs <snapshot.json>          # dry run
 *   node --env-file=.env.local scripts/rollback-audio-backfill.mjs <snapshot.json> --apply
 */
import fs from 'node:fs';

const APPLY = process.argv.includes('--apply');
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Pass the snapshot JSON written before the backfill ran.');
  process.exit(1);
}
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const snap = JSON.parse(fs.readFileSync(file, 'utf8'));

async function restore(table, rows) {
  for (const r of rows) {
    if (!r.snippet_url) continue;
    // Only touch rows that actually moved — re-writing an unchanged row is a
    // pointless write against production.
    const cur = await (await fetch(`${URL_BASE}/rest/v1/${table}?id=eq.${r.id}&select=snippet_url`, { headers: H })).json();
    if (cur?.[0]?.snippet_url === r.snippet_url) { console.log(`  [same] ${r.title}`); continue; }

    // Refuse to restore a URL that no longer resolves — that would swap a
    // working file for a 404.
    const head = await fetch(r.snippet_url, { method: 'HEAD' });
    if (!head.ok) { console.log(`  [SKIP] ${r.title}: old object is gone (${head.status}) — cannot roll back`); continue; }

    if (!APPLY) { console.log(`  [dry]  ${r.title} -> ${r.snippet_url.split('/').pop().slice(-28)}`); continue; }

    const res = await fetch(`${URL_BASE}/rest/v1/${table}?id=eq.${r.id}`, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ snippet_url: r.snippet_url }),
    });
    const out = await res.json();
    // RLS-blocked writes return 0 rows with no error.
    console.log(Array.isArray(out) && out.length ? `  [ok]   ${r.title}` : `  [FAIL] ${r.title}: wrote 0 rows`);
  }
}

(async () => {
  console.log(APPLY ? '=== RESTORING ===' : '=== DRY RUN (pass --apply) ===');
  console.log(`snapshot taken ${snap.takenAt}\n`);
  console.log(`BEATS (${snap.beats.length}):`);   await restore('beats', snap.beats);
  console.log(`\nTRACKS (${snap.tracks.length}):`); await restore('tracks', snap.tracks);
  console.log(APPLY ? '\nDone.' : '\nNothing written.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
