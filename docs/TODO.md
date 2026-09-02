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
