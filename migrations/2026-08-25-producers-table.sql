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
