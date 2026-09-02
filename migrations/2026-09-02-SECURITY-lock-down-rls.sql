-- ============================================================================
-- CRITICAL SECURITY FIX — run this immediately.
--
-- Found by testing the live database with the PUBLIC anon key (the one that
-- ships inside the browser bundle, so anyone who opens devtools has it).
--
-- Three holes, all from leftover "allow everything" policies written early on:
--
--   1. PAYMENT BYPASS (worst). `orders` had "Allow all operations on orders"
--      for {public}. Anyone could: start a checkout (creates a pending order),
--      flip status to 'paid' themselves, then call /api/orders/download and
--      walk off with the full WAV and stems. Verified end to end — 96,906
--      bytes of a paid file downloaded without paying a shilling.
--
--   2. CUSTOMER DATA LEAK. Same policy let anyone read every order: email
--      address, phone number, what they bought, what they paid.
--
--   3. CATALOGUE VANDALISM. `beats` had "Allow public inserts" and
--      "Allow public deletes" for {anon,authenticated}. Any visitor could
--      delete the entire catalogue or inject fake beats. Verified: an anon
--      client deleted a real beat row.
--
-- Everything the app legitimately needs still works after this, because every
-- write path already goes through a server route using the service-role key,
-- which bypasses RLS by design.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. orders — server-only. No browser role touches this table, ever.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all operations on orders" on orders;

-- Belt and braces: even with no policy, don't leave the grant sitting there.
revoke all on orders from anon;
revoke all on orders from authenticated;

-- No policy is created. orders is read and written exclusively by
-- /api/paystack/* and /api/orders/download via supabaseAdmin.

-- ---------------------------------------------------------------------------
-- 2. beats — public may READ the catalogue and nothing else.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public inserts" on beats;
drop policy if exists "Allow public deletes" on beats;

-- Three duplicate SELECT policies had accumulated; collapse to one.
drop policy if exists "Allow public read" on beats;
drop policy if exists "Allow public read access" on beats;
drop policy if exists "Allow public reads" on beats;

drop policy if exists "beats are publicly readable" on beats;
create policy "beats are publicly readable"
  on beats for select
  using (true);

-- Uploads go through /api/beats/upload (service role, after verifying the
-- producer's bearer token), so anon needs no write privileges at all.
revoke insert, update, delete, truncate on beats from anon;

-- Column-level defence: full_url and stems_url are paths into the PRIVATE
-- bucket. Fetching one without a signature already 400s, but there is no
-- reason to publish the paths. RLS is row-level only — this is the column-
-- level equivalent, and Postgres enforces it on SELECT.
-- (The app no longer selects these with the anon key; this makes it
--  impossible rather than merely unintended.)
revoke select (full_url, stems_url) on beats from anon;

-- ---------------------------------------------------------------------------
-- 3. producers — public read is intended (the About page), writes are not.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on producers from anon;
revoke insert, update, delete, truncate on producers from authenticated;
-- Profile edits go through /api/producers/update, which verifies the caller's
-- session server-side and only ever touches their own row.
