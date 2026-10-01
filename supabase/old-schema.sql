-- =========================================================
-- Logbook Supabase schema
-- Run this in the Supabase SQL editor in order.
-- =========================================================

-- Step 1: enable required database extensions
create extension if not exists pgcrypto;

-- Step 2: helper trigger for updated_at timestamps
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Step 3: profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  city text,
  country text,
  avatar_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger handle_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_updated_at_column();

-- Step 4: vehicles table
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  make text not null,
  model text not null,
  year int not null check (year between 1900 and 2100),
  mileage int not null check (mileage >= 0),
  fuel_type text,
  transmission text,
  drivetrain text,
  color text,
  condition text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger handle_vehicles_updated_at
before update on public.vehicles
for each row
execute function public.update_updated_at_column();

-- Step 5: listings table
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  title text not null,
  description text,
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'USD',
  status text not null default 'active' check (status in ('draft', 'active', 'pending_review', 'sold', 'archived')),
  city text,
  region text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger handle_listings_updated_at
before update on public.listings
for each row
execute function public.update_updated_at_column();

-- Step 6: listing images table
create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  image_url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Step 7: messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Step 8: useful indexes for faster access
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_seller_id on public.listings(seller_id);
create index if not exists idx_listings_vehicle_id on public.listings(vehicle_id);
create index if not exists idx_listings_city on public.listings(city);
create index if not exists idx_listings_price on public.listings(price);
create index if not exists idx_listings_created_at on public.listings(created_at desc);
create index if not exists idx_vehicles_seller_id on public.vehicles(seller_id);
create index if not exists idx_vehicles_make_model on public.vehicles(make, model);
create index if not exists idx_vehicles_year on public.vehicles(year);
create index if not exists idx_listing_images_listing_id on public.listing_images(listing_id);
create index if not exists idx_messages_listing_id on public.messages(listing_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_receiver_id on public.messages(receiver_id);

-- Step 9: enable Row Level Security
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.messages enable row level security;

-- Step 10: profiles policies
create policy "Profiles are viewable by everyone"
on public.profiles
for select
using (true);

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

-- Step 11: vehicles policies
create policy "Anyone can view vehicles attached to active listings"
on public.vehicles
for select
using (
  exists (
    select 1
    from public.listings l
    where l.vehicle_id = vehicles.id
      and l.status = 'active'
  )
);

create policy "Users can manage their own vehicles"
on public.vehicles
for all
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

-- Step 12: listings policies
create policy "Anyone can view active listings"
on public.listings
for select
using (status = 'active');

create policy "Users can view their own listings including drafts"
on public.listings
for select
using (auth.uid() = seller_id);

create policy "Authenticated users can create listings"
on public.listings
for insert
with check (auth.uid() = seller_id);

create policy "Users can update their own listings"
on public.listings
for update
using (auth.uid() = seller_id)
with check (auth.uid() = seller_id);

create policy "Users can delete their own listings"
on public.listings
for delete
using (auth.uid() = seller_id);

-- Step 13: listing images policies
create policy "Anyone can view listing images for active listings"
on public.listing_images
for select
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and l.status = 'active'
  )
);

create policy "Users can manage their own listing images"
on public.listing_images
for all
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and l.seller_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and l.seller_id = auth.uid()
  )
);

-- Step 14: messages policies
create policy "Users can view messages involved in their conversations"
on public.messages
for select
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
on public.messages
for insert
with check (auth.uid() = sender_id);

create policy "Users can delete their own messages"
on public.messages
for delete
using (auth.uid() = sender_id);

-- =========================================================
-- End of schema
-- =========================================================
