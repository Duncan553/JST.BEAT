-- Run this once in the Supabase SQL Editor.
--
-- WHY: the dashboard's price editor silently did nothing. RLS had no UPDATE
-- policy on `beats`, and when RLS blocks an update PostgREST returns ZERO
-- rows with error = null — so the UI said "Updated successfully" while the
-- price never changed. The app-side fix (checking the row count) now surfaces
-- the failure; this policy is what actually makes the save work.
--
-- Only the two signed-in producers can reach this: `to authenticated` means
-- the anon key can't use it, and only jst.dan and tisco prodz have accounts.

drop policy if exists "producers can update beats" on beats;
create policy "producers can update beats"
  on beats for update
  to authenticated
  using (true)
  with check (true);

-- Delete already works, but it was never written down as an explicit policy.
-- Pin it so a future RLS change doesn't silently take it away.
drop policy if exists "producers can delete beats" on beats;
create policy "producers can delete beats"
  on beats for delete
  to authenticated
  using (true);
