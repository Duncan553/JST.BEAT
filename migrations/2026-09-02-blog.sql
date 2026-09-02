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
