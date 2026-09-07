# JST.BEAT — build plan

Status key: `[ ]` todo · `[x]` done · `[!]` blocked · `[~]` in progress

---

## 0. Clean slate — DONE
- [x] Back up beats + orders + storage inventory (scratchpad `jst-beat-backup-*.json`)
- [x] Delete all 8 beats, all 38 orders
- [x] Clear `beats-public`, `beats-private`, `beats` buckets (27 files)
- [x] Keep the 2 producer profile photos (not beat data)

---

## 1. Blockers found by the form audit

### 1a. Migrations never run — root cause of ~half the breakage
- [x] `alter table beats add column producer` — APPLIED 2026-09-02, verified
- [x] `create table producers` — APPLIED, both producer rows seeded
- [x] RLS UPDATE policy on `beats` — APPLIED, price edit writes 1 row, anon blocked
- **Unblocked:** all 5 migrations run via the Supabase SQL editor in Chrome, 2026-09-02.

### 1b. Code bugs — fixable now
- [x] `initAuth()` was never called → session never rehydrated, refresh = logged out
- [x] Dashboard guard redirected before `isLoading` resolved → bounced even when logged in
- [x] Upload orphans 4 storage files on every failed insert — now rolled back on failure
- [x] Upload swallowed the real error — now returns the actual reason
- [x] `saveEdit` reported success on 0 rows written — now checks the row count
- [x] Cart deduped on `beat.id` only — cart, remove, and the buy button are licence-aware now
- [ ] Tag audio missing at `assets/tags/` → snippets ship **untagged**
- [x] `business_settlement` now reads `SETTLEMENT_PHONE`
- [x] `handleDelete` had the same 0-row trap — would have wiped files off a live beat
- [ ] `verify` 500s on unknown reference (should be 404); non-UUID `beat_id` 500s (should be 400)
- [ ] Order row inserted *before* the Paystack call → orphan pending rows

---

## 1c. SECURITY — found by testing the live DB with the public anon key (FIXED 2026-09-02)

- [x] **PAYMENT BYPASS.** `orders` had "Allow all operations on orders" for `{public}`.
      Anyone could start a checkout, flip `status` to `paid` themselves, then call
      `/api/orders/download` and take the full WAV + stems. Verified end to end —
      96,906 bytes of a paid file downloaded without paying. **Policy dropped,
      all grants revoked from anon + authenticated. Orders is server-only now.**
- [x] **CUSTOMER DATA LEAK.** Same policy exposed every order: email, phone,
      what they bought, what they paid. **Closed.**
- [x] **CATALOGUE VANDALISM.** `beats` had "Allow public inserts" and "Allow
      public deletes" for `{anon,authenticated}`. Any visitor could wipe the
      catalogue. Verified — an anon client deleted a real beat. **Closed.**
- [x] **PRIVATE PATH DISCLOSURE.** anon could read `full_url` / `stems_url`.
      Fixed with column-level grants (table SELECT revoked, safe columns granted
      back). Note: a column-level REVOKE alone is a no-op while a table-level
      grant exists — that first attempt silently did nothing.
- [x] Three duplicate SELECT policies on `beats` collapsed into one.
- [x] **ffmpeg path broken under Next's bundler** — `ffmpeg-static` resolved to
      `/ROOT/node_modules/...`, so every upload died `spawn ENOENT`. Now resolved
      at runtime with an existence check.

**Still worth doing:** rotate the anon key? Not required — it is public by design
and the holes were the policies, not the key.

---

## 2. Payments — research settled (see §5)

**Paystack does everything. Flutterwave is not needed for the split.**

- [ ] Per-producer subaccount for **both** producers (only tisco's exists today;
      jst.dan is implicitly the main account, so "his money" == "the business pot")
- [ ] Change split rule from all-or-nothing to **per-item**
      (`initialize/route.ts:135` only splits when *every* cart item is tisco's)
- [ ] Enable USD on the Paystack dashboard for beats
- [ ] Confirm with Paystack support that splits apply on USD transactions
- [ ] Decide: Flutterwave as a redundancy checkout only (its split can't pay
      M-Pesa wallets → any Flutterwave sale needs a manual payout)

---

## 3. Store — sell singles & albums (KES only, local)
- [x] Schema written: `migrations/2026-09-02-store.sql` (releases + tracks, RLS, FK indexes)
- [x] Applied + verified (drafts hidden from anon, published visible, `full_url` unreachable by anon)
- [ ] Upload flow in dashboard "Store" tab (currently a COMING SOON placeholder)
- [ ] Reuse `api/paystack/initialize` — no new payment code needed
- [ ] Per-release `producer` column drives the payout split
- [ ] After purchase: stream **and** download (mirror `api/orders/download`)
- [ ] Public `/store` page + release detail page

## 4. Blog — album reviews
- [x] Schema written: `migrations/2026-09-02-blog.sql` (posts, rating 0–10, slug, RLS)
- [x] Applied + verified (rating stores 8.5 correctly)
- [ ] Dashboard "Blog" tab: write / edit / publish
- [ ] Public `/blog` list + post page, star rating out of 10

## 5. Art Museum
- [ ] Parked by request. Leave the COMING SOON placeholder.

---

## 6. Test before calling anything done
- [ ] Upload a beat end-to-end on the clean DB
- [ ] Buy it (KES, M-Pesa) → verify split lands on the right producer
- [ ] Buy a store release → stream + download both work
- [ ] Publish a blog post → renders on /blog with rating
- [ ] Refresh the dashboard → still logged in
- [ ] Edit a price → actually persists

---

## 7. Store player + release windows (captured 2026-09-07, not started)

### 7a. Store player parity with beats — DONE 2026-09-07
- [x] Store releases moved onto `usePlayerStore`. `ReleasePlayer` had its OWN
      `<audio>` element, so a beat and a record could **play over each other**,
      and a store track died on navigation. One element now; verified 1 audio
      node, 1 stream, and a beat correctly replacing a playing record.
- [x] **Volume control** — slider + mute in the player bar, persisted to
      `localStorage` under `jst-beat-player` (volume/muted ONLY; persisting the
      current track would auto-play on a fresh visit). Verified 0.25 applied to
      the element and survived a route change.
      **iOS ignores programmatic `volume` entirely** (Apple reserves it for the
      hardware buttons), so the slider is feature-detected — set 0.5 on a probe
      element, read it back — and hidden where the write does nothing. The mute
      button stays, because muting works everywhere.
      The decorative tonearm was removed to make room; it was ornament sitting
      exactly where a real control belonged.
- [x] `/store` grid plays track 1 straight from the cover. Before this the only
      way to hear anything in the store was to open a release page first.
- [ ] Queue/next-track within an album (an album is an ordered list; a single is a
      list of one — same component either way) — still open

### 7b. Timed release windows ("premiere" mode)
When posting an album from the dashboard, the producer sets a **premiere date**.
Between publish and premiere the release is **listen-free, download-locked**;
buying is what unlocks the download, at any point.

State machine (one `premiere_at timestamptz` column does all of it):
- `premiere_at` NULL → normal: stream free, buy to download. (today's behaviour)
- `now() < premiere_at` → **window**: full stream free, download blocked for
  everyone who has not bought. Page shows a countdown.
- `now() >= premiere_at` → falls back to normal.

- [x] `migrations/2026-09-07-premiere.sql` written — **NOT YET RUN.** Adds a
      nullable `premiere_at timestamptz` + a partial index. Every existing row
      stays NULL = an ordinary release, so running it changes nothing on its own.
- [x] `lib/premiere.ts` — the one state machine (none / upcoming / released),
      countdown wording, and the tick rate. Unit-tested via
      `node --experimental-strip-types`; all cases pass including a malformed
      date falling back to "no premiere" rather than taking the store page down.
- [x] Dashboard Store tab: datetime picker per release + a plain-English line
      saying what the buyer will see. Clearing it restores an ordinary release.
- [x] Countdown badge on the store grid and the release page; buy panel says
      buying is EARLY ACCESS (files now, not on the date).
- [x] `lib/store.ts` falls back when the column is absent (Postgres 42703), so
      the store keeps working between deploying this code and running the
      migration. **Verified live with the column still missing.**
- [x] **CORRECTED 2026-09-07 — a server-side gate IS needed.** The first cut
      treated `premiere_at` as a date only, with streaming free before and after.
      Wachira's rule is the opposite: **audio does not play until it premieres.**
      So `withPremiereGate()` in `lib/store.ts` nulls `snippet_url` on every
      track while `now() < premiere_at`. It lives in the server-side read, not a
      component — hiding a play button while still shipping the URL in the
      payload is a UI-only lock, and anyone could pull it from the network tab.
- [ ] **RESIDUAL GAP:** those stream objects sit in the PUBLIC `beats-public`
      bucket, so a file is still readable by anyone who knows its exact path.
      Withholding the URL removes the only realistic way to find it, but the
      complete fix is uploading pre-premiere streams to the private bucket and
      serving signed URLs. Not done.
- [x] Buying before a premiere is what it should be now: the download still comes
      from `/api/orders/download` on a paid order, so a buyer gets the record
      while nobody else can even play it.

**Why this works (the actual mechanisms, no invented numbers):**
- **Windowing** is standard music-industry practice — staggering free access and
  paid access is how release strategy has worked since radio, and it is what
  Bandcamp's "streamable, buy to download" default already does. This is not a
  novel trick; it is the norm buyers already understand.
- **Mere-exposure effect** (Zajonc): repeated hearing increases liking. A song
  you can play free for a month is a song you have heard twenty times before you
  are asked to pay. Selling a download of an unheard track is the harder sale.
- **Deadline / scarcity effect**: a dated event converts "someday" into "now".
  The countdown is doing the work, not the lock.
- **Goal-gradient**: a visible countdown that shortens pulls harder as it nears
  zero — the reason pre-order and pre-save campaigns are dated at all.
- **Reciprocity**: giving the full listen first, free, is a real gift before the
  ask. This is why the window must be the FULL track, not a 30-second snippet —
  a teaser reads as a paywall, a full stream reads as trust.

**Careful:** the store is Kenyan buyers on mobile data. A free full stream that
autoplays at high bitrate spends their bundle. Stream stays at the existing
128kbps copy; the master is what is sold.

---

## 8. Audio quality — streams and snippets (researched 2026-09-07, not applied)

### What the code does TODAY
- `createStreamCopy()` (`lib/audio-tag.ts`) → **MP3, CBR 128k**, explicit.
- `createSnippet()` (same file) → **no codec and no bitrate set at all.** It
  saves to `outPath` built from the UPLOAD's extension, so the snippet format
  follows whatever was uploaded: upload a WAV and the "snippet" is a **WAV**
  (huge on mobile data); upload an MP3 and you get ffmpeg's 128k default.
  **This inconsistency is the actual bug** — quality is currently an accident
  of what the producer happened to upload.
- The paid **download is the untouched master** from the private bucket.
  That is already correct — do not re-encode it, ever.

### What Spotify actually does (the parts worth copying)
- Streams **Ogg Vorbis** at ~96 / 160 / 320 kbps by tier; the web player uses
  **AAC** at 128 (free) / 256 (premium). Note what is NOT on that list: MP3.
- **Loudness-normalises every track to −14 LUFS integrated** (EBU R128), with
  −11 and −19 alternatives. This is the thing people hear as "Spotify sounds
  good", and it is not a bitrate feature at all.

### The science, and what it means here
1. **Codec generation beats bitrate.** AAC and Opus are roughly a decade and
   two decades newer than MP3 respectively, and both are clearly better at the
   same bitrate — public listening tests (Hydrogenaudio) put Opus ~96–128k and
   AAC ~128k near transparency where MP3 128k is audibly not. **Switching the
   stream from MP3 128k to AAC 128k is free quality: same bytes, better sound.**
2. **Loudness normalisation is the bigger perceived-quality lever.** A beat
   mastered at −6 LUFS next to one at −16 makes the quiet one sound weak and
   "worse" regardless of bitrate. ffmpeg's `loudnorm` filter implements EBU
   R128 — **use the two-pass form**; single-pass loudnorm is a rough estimate
   and can pump.
3. **Never transcode a transcode.** Cascaded lossy encoding compounds
   artefacts. The stream must always be built from the **master** (WAV), never
   from an MP3 a producer uploaded. Today `createStreamCopy` runs on whatever
   arrived, so an MP3 upload silently becomes a second-generation MP3.
4. **VBR over CBR** if MP3 is kept for any reason (`-q:a 2` ≈ 190k average) —
   better quality per byte, since bits follow the difficulty of the passage.
5. Keep **44.1 kHz stereo**. Upsampling adds bytes and zero information.

### Recommended settings
**AAC-LC 128 kbps in `.m4a`**, not Opus. Opus is technically better per byte,
but Safari/iOS support for it has been patchy for years, and a beat that will
not play on somebody's iPhone is worth less than a slightly larger file.
AAC-LC in m4a plays everywhere.

```
-c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart
-af loudnorm=I=-14:TP=-1.5:LRA=11   (two-pass)
```
`+faststart` moves the index to the front of the file so playback can begin
before the whole thing has downloaded — on mobile data that is the difference
between instant and a three-second stall.

- [x] `createStreamCopy` → **AAC 128k m4a + two-pass loudnorm**, DONE 2026-09-07
- [x] `createSnippet` → forced `.m4a`; no longer inherits the upload's extension
- [x] Both upload routes fixed too — `app/api/beats/upload` was naming the
      snippet after the ORIGINAL file and setting the ORIGINAL content-type, so
      a WAV beat published a `.wav` snippet served as `audio/wav`.
- [x] Loudness is **best effort**: if pass 1 fails or ffmpeg is missing, the
      encode still happens un-normalised. An upload must never fail because the
      loudness pass could not run.
- [x] Measured end to end with the real binary: a −42.05 LUFS input came out at
      **−14.1 LUFS**, `+faststart` fired, and **1,411,278 → 130,800 bytes**
      (10.8×). Output confirmed `aac (LC), 44100 Hz, stereo, 128 kb/s`, M4A.
- [x] Keep the paid download byte-identical to the master — unchanged, still the
      untouched original from the private bucket.
- [ ] Always encode from the master when the producer uploaded a lossy file
      (avoids second-generation artefacts) — still open

**Caveat found while testing:** ffmpeg silently falls back from `linear=true` to
dynamic normalisation when the required gain would breach the true-peak ceiling
— it did so on the −42 LUFS test tone, which needed +28 dB. Real masters sit
close enough to −14 that linear engages, which is the case that matters.

**STILL THE BLOCKER:** ffmpeg has never run successfully on Vercel (§1c). These
changes are verified locally against the real binary but the production path is
unproven. Test ONE real upload on the deployed site before trusting it.

**BLOCKER before shipping any of this:** ffmpeg's production path has never
run successfully on Vercel (see §1c — `outputFileTracingIncludes` ships the
binary and `assets/tags/`, untested because uploads used to die at the 413
before reaching it). Changing encoder flags and the Vercel ffmpeg bring-up are
two separate risks; do not debug them at the same time. Test one real upload on
the deployed site FIRST, then change the codec.
