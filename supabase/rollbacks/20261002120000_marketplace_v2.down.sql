-- =========================================================
-- Rollback for migration 20261002120000: marketplace v2
--
-- Returns the database to supabase/schema.sql (the baseline). Run it in the
-- Supabase SQL Editor. It's kept outside supabase/migrations/ so the Supabase
-- CLI never applies it as a forward migration.
--
-- Runs in one transaction. It refuses (changing nothing) when rolling back
-- would lose data the old schema can't hold: soft-deleted rows, non-active
-- listings, extra photos, or rows in the new tables. Deal with those first.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. Pre-flight: refuse rather than lose data
-- ---------------------------------------------------------
do $$
declare
  bad int;
begin
  select count(*) into bad from public.users where deleted_at is not null;
  if bad > 0 then
    raise exception 'Rollback stopped: % soft-deleted user(s) would come back to life. Hard-delete them or clear deleted_at first: select id, email from public.users where deleted_at is not null;', bad;
  end if;

  select count(*) into bad from public.listings where deleted_at is not null or status <> 'active';
  if bad > 0 then
    raise exception 'Rollback stopped: % listing(s) are deleted, draft, sold or removed, and would all show as live. See: select id, status, deleted_at from public.listings where deleted_at is not null or status <> ''active'';', bad;
  end if;

  select count(*) into bad from public.listing_photos where position <> 0;
  if bad > 0 then
    raise exception 'Rollback stopped: % extra photo(s) (position > 0); the old schema allows one photo per listing. See: select id, listing_id, position from public.listing_photos where position <> 0;', bad;
  end if;

  select (select count(*) from public.favourites)
       + (select count(*) from public.password_reset_tokens)
       + (select count(*) from public.email_verification_tokens)
       + (select count(*) from public.reports)
    into bad;
  if bad > 0 then
    raise exception 'Rollback stopped: % row(s) in favourites, password_reset_tokens, email_verification_tokens or reports would be dropped. Export or clear them first.', bad;
  end if;

  select count(*) into bad from public.conversations
    where seller_id = '00000000-0000-4000-8000-000000000001'
       or buyer_id = '00000000-0000-4000-8000-000000000001';
  if bad > 0 then
    raise exception 'Rollback stopped: % conversation(s) involve the demo seller account, which the rollback removes.', bad;
  end if;
end $$;

-- ---------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------
drop table public.reports;
drop table public.email_verification_tokens;
drop table public.password_reset_tokens;
drop table public.favourites;

-- ---------------------------------------------------------
-- 2. messages
-- ---------------------------------------------------------
drop trigger messages_check_sender on public.messages;
drop function public.check_message_sender();
drop index public.messages_conversation_created_at;

-- ---------------------------------------------------------
-- 3. conversations (the baseline's unique key and indexes stay)
-- ---------------------------------------------------------
alter table public.conversations drop constraint conversations_buyer_not_seller;

-- ---------------------------------------------------------
-- 4. sessions
-- ---------------------------------------------------------
drop index public.sessions_expires_at;
alter table public.sessions
  drop column revoked_at,
  drop column user_agent,
  drop column ip;

-- ---------------------------------------------------------
-- 5. listing_photos: back to one photo per listing, keyed by listing_id
-- ---------------------------------------------------------
alter table public.listing_photos drop constraint listing_photos_listing_id_position_key;
alter table public.listing_photos drop constraint listing_photos_pkey;
alter table public.listing_photos
  drop column id,
  drop column position,
  drop column created_at,
  drop column storage_key;
alter table public.listing_photos add constraint listing_photos_pkey primary key (listing_id);

-- ---------------------------------------------------------
-- 6. listings
-- ---------------------------------------------------------
drop trigger listings_set_updated_at on public.listings;
drop index public.listings_status_created_at;
drop index public.listings_make_model;
drop index public.listings_price;
drop index public.listings_year;

alter table public.listings
  drop constraint listings_price_non_negative,
  drop constraint listings_odometer_non_negative,
  drop constraint listings_year_range;

alter table public.listings
  drop column status,
  drop column updated_at,
  drop column sold_at,
  drop column deleted_at,
  drop column fuel_type,
  drop column transmission,
  drop column body_type,
  drop column num_owners,
  drop column registration,
  drop column nct_expiry,
  drop column county;

-- created_at: timestamptz -> date (the time of day is dropped).
alter table public.listings alter column created_at drop default;
alter table public.listings
  alter column created_at type date using ((created_at at time zone 'UTC')::date);
alter table public.listings alter column created_at set default current_date;

-- Demo listings go back to having no seller.
alter table public.listings alter column seller_id drop not null;
update public.listings
  set seller_id = null
  where seller_id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------
-- 7. users
-- ---------------------------------------------------------
drop trigger users_set_updated_at on public.users;
delete from public.users where id = '00000000-0000-4000-8000-000000000001';
drop index public.users_deleted_at;
alter table public.users
  drop column email_verified_at,
  drop column updated_at,
  drop column deleted_at;

-- ---------------------------------------------------------
-- 8. Shared function and enums
-- ---------------------------------------------------------
drop function public.set_updated_at();
drop type public.report_status;
drop type public.transmission_type;
drop type public.fuel_type;
drop type public.listing_status;

notify pgrst, 'reload schema';

commit;
