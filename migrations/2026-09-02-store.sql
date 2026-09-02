-- Run this once in the Supabase SQL Editor, AFTER the producer-column migration.
--
-- The STORE: finished music sold to local buyers in KES only. A release is
-- either a single (one track) or an album (many). Buyers can stream it or
-- download it after paying. No USD here — that's beats-only.
--
-- Payment reuses /api/paystack/initialize unchanged: the `producer` column
-- below is what routes the money to the right person's M-Pesa via their
-- Paystack subaccount, exactly like beats do.

-- ---------------------------------------------------------------------------
-- releases
-- ---------------------------------------------------------------------------
create table if not exists releases (
  id uuid primary key default gen_random_uuid(),

  -- Who gets paid. Same two-value check as beats.producer so a typo can't
  -- silently orphan the money.
  producer text not null check (producer in ('jst.dan', 'tisco prodz')),

  kind text not null check (kind in ('single', 'album')),
  title text not null check (length(title) between 1 and 200),
  description text,

  -- Public bucket URL. Safe to expose to anon.
  cover_art text not null,

  -- KES. numeric, never float — float8 cannot represent 1999.99 exactly and
  -- money must not drift.
  price numeric(10, 2) not null check (price > 0),

  -- Nothing is visible on /store until this is flipped on.
  published boolean not null default false,

  created_at timestamptz not null default now()
);

-- Both of these back real query shapes: the dashboard lists one producer's
-- releases; /store lists published ones newest-first.
create index if not exists releases_producer_idx on releases (producer);
create index if not exists releases_published_created_idx
  on releases (published, created_at desc);

-- ---------------------------------------------------------------------------
-- tracks
-- ---------------------------------------------------------------------------
create table if not exists tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id) on delete cascade,

  title text not null check (length(title) between 1 and 200),
  track_number int not null check (track_number > 0),

  -- Public tagged preview. Null while a release is still being assembled.
  snippet_url text,

  -- PRIVATE bucket. This is the thing being sold — it must never reach the
  -- browser except as a signed URL from /api/orders/download after payment.
  full_url text not null,

  duration_seconds int check (duration_seconds > 0),
  created_at timestamptz not null default now(),

  -- No two tracks share a slot on the same release.
  unique (release_id, track_number)
);

-- Postgres does NOT index foreign keys automatically. Without this, every
-- "load an album's tracks" is a seq scan, and deleting a release has to scan
-- the whole table to cascade.
create index if not exists tracks_release_id_idx on tracks (release_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table releases enable row level security;
alter table tracks   enable row level security;

-- Anon may read published releases. Nothing private lives on this table —
-- cover art is already a public URL and the price is meant to be seen.
drop policy if exists "published releases are public" on releases;
create policy "published releases are public"
  on releases for select
  using (published = true);

-- Producers see everything, including their own unpublished drafts.
drop policy if exists "producers read all releases" on releases;
create policy "producers read all releases"
  on releases for select
  to authenticated
  using (true);

drop policy if exists "producers write releases" on releases;
create policy "producers write releases"
  on releases for all
  to authenticated
  using (true)
  with check (true);

-- DELIBERATELY no anon policy on `tracks`. RLS is row-level, not column-level:
-- if anon could select the table at all, it could ask for `full_url` and walk
-- off with the private path. The public /store page reads tracks through
-- /api/store/releases instead, which uses the service-role client and hand-
-- picks the safe columns.
drop policy if exists "producers manage tracks" on tracks;
create policy "producers manage tracks"
  on tracks for all
  to authenticated
  using (true)
  with check (true);
