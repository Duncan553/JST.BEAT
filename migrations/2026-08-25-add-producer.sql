-- Run this once in the Supabase SQL Editor.
-- Adds producer attribution so beats show who made them.

alter table beats
  add column if not exists producer text
  check (producer in ('jst.dan', 'tisco prodz'));

-- Backfill existing beats — adjust if any of your current catalog
-- actually belongs to tisco prodz.
update beats set producer = 'jst.dan' where producer is null;
