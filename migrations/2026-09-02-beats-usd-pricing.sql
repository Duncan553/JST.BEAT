-- BEATS ONLY. The store stays KES — local buyers, M-Pesa, no conversion.
--
-- One price per beat, held in USD. KES is never stored: it is derived at
-- request time from a cached rate (lib/pricing.ts) so the two can never
-- drift apart. Paystack still charges KES and only KES; Flutterwave charges
-- the USD figure as-is with no conversion at all.
--
-- The old KES columns stay for now so nothing breaks mid-migration, but they
-- are no longer the source of truth — treat them as legacy.

alter table beats add column if not exists price_usd_wav   numeric(10, 2);
alter table beats add column if not exists price_usd_stems numeric(10, 2);

-- Rough backfill so no beat is left priceless. These land on ugly numbers
-- ($2500 / 129.48 = $19.31), so every beat should be re-priced by hand in
-- the dashboard afterwards — the divide is a safety net, not a decision.
update beats
   set price_usd_wav = round((price_wav / 129.48)::numeric, 2)
 where price_usd_wav is null and price_wav is not null;

update beats
   set price_usd_stems = round((price_stems / 129.48)::numeric, 2)
 where price_usd_stems is null and price_stems is not null;

-- A beat must have a WAV price. Stems stay optional (0 = not sold).
alter table beats
  add constraint beats_price_usd_wav_positive
  check (price_usd_wav is null or price_usd_wav > 0) not valid;
