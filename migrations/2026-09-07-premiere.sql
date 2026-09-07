-- PREMIERE DATES for store releases.
-- APPLIED to production 2026-09-07 ("Success. No rows returned"), verified by
-- reading back premiere_at + explicit. Safe to re-run.
--
-- WHAT THIS DOES, and what it deliberately does NOT do:
--
-- The store's core rule is already in place and does not change: anyone can
-- stream a record free, end to end, and the master file only ever comes out of
-- /api/orders/download after a paid order. This migration does not add a new
-- lock — the lock exists.
--
-- What it adds is a DATE. An artist posts a record, sets a premiere a week or
-- a month out, and until that moment the release carries a countdown and buyers
-- get the download early. The value is a dated event to point people at, not a
-- technical gate: see docs/TODO.md §7b for the mechanisms (windowing,
-- mere-exposure, deadline effect, reciprocity).
--
-- NULL premiere_at = a normal release, exactly as the store behaves today.
-- Every existing row stays NULL, so nothing changes until an artist sets one.

alter table releases
  add column if not exists premiere_at timestamptz;

-- Parental advisory. The artist's call per release, not a guess made from the
-- audio — defaults to false so nothing is labelled without someone choosing it.
alter table releases
  add column if not exists explicit boolean not null default false;

comment on column releases.explicit is
  'Parental advisory / explicit content. Set by the artist; drives the badge on '
  'the cover art wherever the release is shown.';

comment on column releases.premiere_at is
  'Optional dated premiere. NULL = ordinary release. While now() < premiere_at '
  'the store shows a countdown and buyers get early access to the download; '
  'streaming is free before and after, and the paid-download rule is unchanged.';

-- /store sorts published releases newest-first and now also needs to find the
-- ones still counting down. Partial index: only rows that actually have a date,
-- which is the minority and stays small.
create index if not exists releases_premiere_idx
  on releases (premiere_at)
  where premiere_at is not null;
