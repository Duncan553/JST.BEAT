-- The store sells finished music, so a release has TWO people attached:
--   producer -> who made the beat and therefore who gets paid (drives the
--               Paystack subaccount split). Already on the table.
--   artist   -> the singer/performer whose name goes on the cover. New.
-- These are often different people, so they can't share one column.

alter table releases add column if not exists artist text;

-- Album/single artwork already exists as `cover_art` (public bucket URL).
-- Nothing else to add for cover or price.
