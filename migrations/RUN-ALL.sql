-- ============================================================
-- JST.BEAT — run this ONCE, top to bottom, in the Supabase SQL Editor.
-- Order matters: the producer column must exist before the rest.
-- Safe to re-run: every statement is idempotent.
-- Generated 2026-09-02
-- ============================================================

-- ============================================================
-- STEP: 2026-08-25-add-producer.sql
-- ============================================================
-- Run this once in the Supabase SQL Editor.
-- Adds producer attribution so beats show who made them.

alter table beats
  add column if not exists producer text
  check (producer in ('jst.dan', 'tisco prodz'));

-- Backfill existing beats — adjust if any of your current catalog
-- actually belongs to tisco prodz.
update beats set producer = 'jst.dan' where producer is null;

-- ============================================================
-- STEP: 2026-08-25-producers-table.sql
-- ============================================================
-- Run this once in the Supabase SQL Editor (after the producer-column
-- migration). Lets each producer self-edit their photo/socials from the
-- dashboard Profile tab, and lets the public About page read them.

create table if not exists producers (
  email text primary key,
  name text not null check (name in ('jst.dan', 'tisco prodz')),
  full_name text, -- real/legal name, self-entered — nobody else should guess this
  photo_url text,
  whatsapp text,
  instagram text,
  tiktok text,
  twitter text,
  youtube text,
  updated_at timestamptz not null default now()
);

alter table producers enable row level security;

-- Public can read (About page needs this via the anon key) — nothing
-- private is stored here, just bio/contact info meant to be shown.
drop policy if exists "producers are publicly readable" on producers;
create policy "producers are publicly readable"
  on producers for select
  using (true);

-- No anon insert/update/delete policy exists, so writes only happen
-- through /api/producers/update, which uses the service-role key after
-- verifying the caller's Supabase session server-side.

insert into producers (email, name, whatsapp, instagram)
values
  ('dwachira2002@gmail.com', 'jst.dan', '0114256994', 'j.s.tdan'),
  -- Paystack's account lookup confirms this number IS tisco prodz's own
  -- M-Pesa line (registered first name: Scott). full_name intentionally
  -- left blank — he sets it himself from the Profile tab.
  ('tscoprodz@gmail.com', 'tisco prodz', '0711405010', 'tiscoprodz')
on conflict (email) do nothing;

-- ============================================================
-- STEP: 2026-09-02-fix-beats-update-policy.sql
-- ============================================================
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

-- ============================================================
-- STEP: 2026-09-02-store.sql
-- ============================================================
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

-- ============================================================
-- STEP: 2026-09-02-blog.sql
-- ============================================================
-- Run this once in the Supabase SQL Editor.
--
-- The BLOG: album reviews, scored out of 10. Nothing is sold here, so there
-- is no producer/payout column — `author` is just a byline.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),

  author text not null check (author in ('jst.dan', 'tisco prodz')),

  -- URL-safe identifier, so a post lives at /blog/<slug> rather than a uuid.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  title text not null check (length(title) between 1 and 200),

  -- What's being reviewed. Both nullable so the blog can also carry a plain
  -- post that isn't an album review.
  album_artist text,
  album_title text,

  cover_art text,
  body text not null,

  -- Out of 10, one decimal — 8.5 is a real rating, and numeric keeps it exact.
  -- Null means "not a scored review".
  rating numeric(3, 1) check (rating >= 0 and rating <= 10),

  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backs the only query the public /blog page makes: published, newest first.
create index if not exists posts_published_created_idx
  on posts (published, created_at desc);

alter table posts enable row level security;

-- Everything on a published post is meant to be read by anyone.
drop policy if exists "published posts are public" on posts;
create policy "published posts are public"
  on posts for select
  using (published = true);

-- Producers additionally see and edit their own unpublished drafts.
drop policy if exists "producers read all posts" on posts;
create policy "producers read all posts"
  on posts for select
  to authenticated
  using (true);

drop policy if exists "producers write posts" on posts;
create policy "producers write posts"
  on posts for all
  to authenticated
  using (true)
  with check (true);
