-- Follow-up to 2026-09-02-SECURITY-lock-down-rls.sql.
--
-- That migration's `revoke select (full_url, stems_url) ... from anon` was a
-- no-op: Postgres ignores a column-level REVOKE while a table-level SELECT
-- grant is still in place. The table grant wins. To get column-level control
-- you must drop the table-wide grant and hand back only the safe columns.

revoke select on beats from anon;

-- Everything the catalogue, the beat detail page and the cart legitimately
-- need — and nothing that points into the private bucket.
grant select (
  id, title, bpm, "key", genre,
  cover_art, snippet_url,
  price_mp3, price_wav, price_stems,
  producer, tags, created_at
) on beats to anon;

-- full_url and stems_url are now unreachable with the anon key. The only way
-- to get them is /api/orders/download, which uses the service role and checks
-- the order is actually paid first.
