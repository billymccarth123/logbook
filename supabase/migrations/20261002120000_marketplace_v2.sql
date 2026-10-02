-- =========================================================
-- Migration 20261002120000: marketplace v2
--
-- Applies on top of supabase/schema.sql (the baseline). Run once, in the
-- Supabase SQL Editor or with `supabase db push`. Rollback:
-- supabase/rollbacks/20261002120000_marketplace_v2.down.sql
--
-- Runs in one transaction: if any check fails, nothing is changed.
--
--   * Multiple photos per listing (listing_photos gets its own id + position)
--   * Listings: required seller, timestamps, status, soft delete, more specs
--   * Users: email verification, updated_at, soft delete
--   * Sessions: revocation and device info
--   * Data integrity checks on conversations and messages
--   * New tables: favourites, password_reset_tokens,
--     email_verification_tokens, reports
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. Pre-flight: stop (changing nothing) if existing rows would break a new
--    constraint. Fix or remove those rows by hand, then run this again.
-- ---------------------------------------------------------
do $$
declare
  bad int;
begin
  select count(*) into bad from public.listings
    where price < 0 or odometer_km < 0
       or year < 1900 or year > extract(year from now())::int + 1;
  if bad > 0 then
    raise exception 'Migration stopped: % listing(s) have a negative price or odometer, or a year outside 1900..next year. See: select id, price, odometer_km, year from public.listings where price < 0 or odometer_km < 0 or year < 1900 or year > extract(year from now())::int + 1;', bad;
  end if;

  select count(*) into bad from public.conversations where buyer_id = seller_id;
  if bad > 0 then
    raise exception 'Migration stopped: % conversation(s) have the same buyer and seller. See: select * from public.conversations where buyer_id = seller_id;', bad;
  end if;

  select count(*) into bad from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.sender_id <> c.buyer_id and m.sender_id <> c.seller_id;
  if bad > 0 then
    raise exception 'Migration stopped: % message(s) were sent by someone outside their conversation. See: select m.* from public.messages m join public.conversations c on c.id = m.conversation_id where m.sender_id not in (c.buyer_id, c.seller_id);', bad;
  end if;

  select count(*) into bad from (
    select lower(email::text) from public.users group by 1 having count(*) > 1
  ) duplicates;
  if bad > 0 then
    raise exception 'Migration stopped: % email address(es) are used by more than one user. See: select lower(email::text), count(*) from public.users group by 1 having count(*) > 1;', bad;
  end if;
end $$;

-- ---------------------------------------------------------
-- 1. Shared trigger: keep updated_at current on every UPDATE
-- ---------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2. Enums
-- ---------------------------------------------------------
create type public.listing_status as enum ('draft', 'active', 'sold', 'removed');
create type public.fuel_type as enum ('petrol', 'diesel', 'hybrid', 'plug_in_hybrid', 'electric');
create type public.transmission_type as enum ('manual', 'automatic');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------
-- 3. users
--    role and status stay as text + CHECK ('user'/'admin',
--    'active'/'suspended'): the baseline already has those checks, the app's
--    TypeScript unions match them, and every row uses only those values.
-- ---------------------------------------------------------
alter table public.users
  add column email_verified_at timestamptz,
  add column updated_at timestamptz,
  add column deleted_at timestamptz;

update public.users set updated_at = created_at;
alter table public.users
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Email is already UNIQUE (citext, so case-insensitive) in the baseline.
-- Add it only if that constraint is missing.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and contype = 'u'
      and conkey = array[(select attnum from pg_attribute
                          where attrelid = 'public.users'::regclass and attname = 'email')]
  ) then
    alter table public.users add constraint users_email_key unique (email);
  end if;
end $$;

create index users_deleted_at on public.users (deleted_at) where deleted_at is not null;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

-- Owner of the demo listings, so listings.seller_id can be NOT NULL.
-- It can't log in: the password hash isn't a valid scrypt hash and the
-- account is suspended. The app shows its listings as "Demo listing" and
-- hides the account from admin lists (DEMO_SELLER_ID in lib/listings.ts).
insert into public.users (id, email, name, password_hash, status, details)
values ('00000000-0000-4000-8000-000000000001', 'demo-seller@trucost.invalid',
        'TRUCOST demo listings', '!disabled', 'suspended', '{}')
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- 4. listings
-- ---------------------------------------------------------

-- seller_id: backfill the demo listings, then require a seller.
-- The existing FK to users(id) ON DELETE CASCADE is kept.
update public.listings
  set seller_id = '00000000-0000-4000-8000-000000000001'
  where seller_id is null;
alter table public.listings alter column seller_id set not null;

-- created_at: date -> timestamptz (existing dates become midnight UTC).
alter table public.listings alter column created_at drop default;
alter table public.listings
  alter column created_at type timestamptz using (created_at::timestamp at time zone 'UTC');
alter table public.listings alter column created_at set default now();

alter table public.listings
  add column status public.listing_status not null default 'active',
  add column updated_at timestamptz,
  add column sold_at timestamptz,
  add column deleted_at timestamptz,
  add column fuel_type public.fuel_type,
  add column transmission public.transmission_type,
  add column body_type text,
  add column num_owners int,
  add column registration text,
  add column nct_expiry date,
  -- NOTE: duplicates the existing `location` column, which already holds the
  -- county and is what the app reads and writes. Left empty; pick one.
  add column county text;

update public.listings set updated_at = created_at;
alter table public.listings
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.listings
  add constraint listings_price_non_negative check (price >= 0),
  add constraint listings_odometer_non_negative check (odometer_km >= 0),
  -- Uses now(): Postgres allows it in a CHECK, and the upper bound only ever
  -- loosens over time, so rows valid today stay valid.
  add constraint listings_year_range
    check (year between 1900 and extract(year from now())::int + 1);

create index listings_status_created_at on public.listings (status, created_at desc);
create index listings_make_model on public.listings (make, model);
create index listings_price on public.listings (price);
create index listings_year on public.listings (year);
-- seller_id is already indexed by listings_seller (baseline).
create index if not exists listings_seller on public.listings (seller_id);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 5. listing_photos: many photos per listing
-- ---------------------------------------------------------

-- Drop the old primary key on listing_id (whatever it's called).
do $$
declare
  pk text;
begin
  select conname into pk from pg_constraint
    where conrelid = 'public.listing_photos'::regclass and contype = 'p';
  if pk is not null then
    execute format('alter table public.listing_photos drop constraint %I', pk);
  end if;
end $$;

-- Adding an identity column numbers the existing rows.
alter table public.listing_photos
  add column id bigint generated by default as identity;
alter table public.listing_photos
  add constraint listing_photos_pkey primary key (id);

-- Each listing had at most one photo (listing_id was the key), so every
-- existing row becomes position 0 without clashing.
alter table public.listing_photos
  add column position int not null default 0,
  add column created_at timestamptz,
  -- TODO: move image bytes to object storage (e.g. Supabase Storage). Fill in
  -- storage_key, switch the app to read from it, then drop `data` and `mime`
  -- in a later migration. Both are kept for now.
  add column storage_key text;

update public.listing_photos set created_at = updated_at;
alter table public.listing_photos
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.listing_photos
  add constraint listing_photos_listing_id_position_key unique (listing_id, position);

-- The baseline FK to listings(id) ON DELETE CASCADE is kept. Add it only if missing.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listing_photos'::regclass and contype = 'f'
      and confrelid = 'public.listings'::regclass
  ) then
    alter table public.listing_photos
      add constraint listing_photos_listing_id_fkey
      foreign key (listing_id) references public.listings(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------
-- 6. sessions
-- ---------------------------------------------------------
alter table public.sessions
  add column revoked_at timestamptz,
  add column user_agent text,
  add column ip inet;

-- The FK to users(id) ON DELETE CASCADE and the user_id index
-- (sessions_user) already exist in the baseline.
create index if not exists sessions_user on public.sessions (user_id);
create index sessions_expires_at on public.sessions (expires_at);

-- ---------------------------------------------------------
-- 7. conversations
-- ---------------------------------------------------------

-- UNIQUE (listing_id, buyer_id) exists in the baseline. Add it only if missing.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass and contype = 'u'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.conversations'::regclass and attname = 'listing_id'),
        (select attnum from pg_attribute where attrelid = 'public.conversations'::regclass and attname = 'buyer_id')]::smallint[]
  ) then
    alter table public.conversations
      add constraint conversations_listing_id_buyer_id_key unique (listing_id, buyer_id);
  end if;
end $$;

alter table public.conversations
  add constraint conversations_buyer_not_seller check (buyer_id <> seller_id);

-- buyer_id and seller_id are already indexed: the baseline indexes
-- conversations_buyer (buyer_id, last_message_at) and conversations_seller
-- (seller_id, last_message_at) start with them.
create index if not exists conversations_buyer on public.conversations (buyer_id, last_message_at);
create index if not exists conversations_seller on public.conversations (seller_id, last_message_at);

-- ---------------------------------------------------------
-- 8. messages
-- ---------------------------------------------------------
create index messages_conversation_created_at on public.messages (conversation_id, created_at);

-- Only the conversation's buyer or seller may send in it. (The app checks
-- this too, in sendMessage / startConversation in lib/messages.ts.)
create function public.check_message_sender()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from conversations c
    where c.id = new.conversation_id
      and new.sender_id in (c.buyer_id, c.seller_id)
  ) then
    raise exception 'sender % is not part of conversation %', new.sender_id, new.conversation_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger messages_check_sender
before insert or update of sender_id, conversation_id on public.messages
for each row execute function public.check_message_sender();

-- ---------------------------------------------------------
-- 9. New tables
-- ---------------------------------------------------------
create table public.favourites (
  user_id uuid not null references public.users(id) on delete cascade,
  listing_id bigint not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favourites_listing on public.favourites (listing_id);

-- Same pattern as sessions: only the SHA-256 hash of the emailed token is stored.
create table public.password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index password_reset_tokens_user on public.password_reset_tokens (user_id);
create index password_reset_tokens_expires_at on public.password_reset_tokens (expires_at);

create table public.email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index email_verification_tokens_user on public.email_verification_tokens (user_id);
create index email_verification_tokens_expires_at on public.email_verification_tokens (expires_at);

create table public.reports (
  id bigint generated by default as identity primary key,
  reporter_id uuid not null references public.users(id) on delete cascade,
  listing_id bigint references public.listings(id) on delete cascade,
  reported_user_id uuid references public.users(id) on delete cascade,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_has_target check (listing_id is not null or reported_user_id is not null)
);
create index reports_status_created_at on public.reports (status, created_at desc);
create index reports_reporter on public.reports (reporter_id);
create index reports_listing on public.reports (listing_id) where listing_id is not null;
create index reports_reported_user on public.reports (reported_user_id) where reported_user_id is not null;

-- Same lockdown as the baseline: server (service role) access only.
alter table public.favourites enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.reports enable row level security;

-- Tell the Supabase API about the new columns and tables straight away.
notify pgrst, 'reload schema';

commit;
