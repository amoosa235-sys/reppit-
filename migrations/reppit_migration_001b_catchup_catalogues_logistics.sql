-- =====================================================================
-- Reppit — Catch-up migration: catalogues, distributor_details,
-- distribution_hubs, consolidated_loads, load_bookings.
--
-- These were defined in the original reppit_schema.sql but may never
-- have been executed if the v1 build only created what the trimmed
-- (reps + printers) scope needed. This script is SAFE TO RUN
-- regardless of current state — everything uses IF NOT EXISTS, so it
-- won't error or touch anything that already exists.
--
-- Run this BEFORE reppit_migration_002_orders_progress.sql — that
-- migration rebuilds `orders` from scratch and expects `catalogues`
-- to already exist.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums — create only if missing (Postgres has no native
-- "CREATE TYPE IF NOT EXISTS", so check pg_type first)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'coverage_method') then
    create type coverage_method as enum ('town_list', 'radius');
  end if;
  if not exists (select 1 from pg_type where typname = 'coverage_scope') then
    create type coverage_scope as enum ('single_town', 'multi_town', 'regional', 'provincial');
  end if;
  if not exists (select 1 from pg_type where typname = 'catalogue_role') then
    create type catalogue_role as enum ('manufacturer', 'distributor', 'both');
  end if;
  if not exists (select 1 from pg_type where typname = 'load_status') then
    create type load_status as enum ('open', 'full', 'departed', 'cancelled');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- distributor_details
-- ---------------------------------------------------------------------
create table if not exists distributor_details (
  provider_profile_id uuid primary key references provider_profiles(id) on delete cascade,
  product_categories_sought text[] default '{}',
  coverage_method coverage_method not null default 'town_list',
  covered_towns text[] default '{}',
  hub_town text,
  radius_km numeric,
  coverage_scope coverage_scope not null default 'single_town',
  min_order_qty integer,
  portfolio_gap_notes text
);

-- ---------------------------------------------------------------------
-- Catalogues
-- ---------------------------------------------------------------------
create table if not exists catalogues (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references users(id) on delete cascade,
  role catalogue_role not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_catalogues_business on catalogues (business_user_id);

create table if not exists catalogue_items (
  id uuid primary key default gen_random_uuid(),
  catalogue_id uuid not null references catalogues(id) on delete cascade,
  product_name text not null,
  sku text,
  description text,
  price numeric,
  moq integer,
  photos text[] default '{}',
  category text
);
create index if not exists idx_catalogue_items_catalogue on catalogue_items (catalogue_id);

-- Make sure `unlocks` can actually reference a catalogue (this column
-- may not exist if the v1 build's unlocks table was simplified).
alter table unlocks add column if not exists catalogue_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_unlocks_catalogue'
  ) then
    alter table unlocks
      add constraint fk_unlocks_catalogue foreign key (catalogue_id) references catalogues(id);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Logistics: distribution hubs & consolidated loads
-- ---------------------------------------------------------------------
create table if not exists distribution_hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id uuid references locations(id),
  operator_provider_id uuid references provider_profiles(id),
  routes_served text[] default '{}'
);

create table if not exists consolidated_loads (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references distribution_hubs(id) on delete cascade,
  destination_region text not null,
  capacity numeric,
  capacity_booked numeric not null default 0,
  departure_date date not null,
  price_per_unit numeric,
  status load_status not null default 'open'
);
create index if not exists idx_loads_hub on consolidated_loads (hub_id);
create index if not exists idx_loads_departure on consolidated_loads (departure_date);

create table if not exists load_bookings (
  id uuid primary key default gen_random_uuid(),
  load_id uuid not null references consolidated_loads(id) on delete cascade,
  booked_by_user_id uuid not null references users(id),
  quantity numeric not null,
  tokens_spent integer not null,
  booked_at timestamptz not null default now()
);
create index if not exists idx_load_bookings_load on load_bookings (load_id);

-- =====================================================================
-- NOTE: this script intentionally does NOT create `orders` — that
-- table is fully defined (with more fields than this had originally)
-- by reppit_migration_002_orders_progress.sql, which drops/recreates
-- it. Run that migration right after this one.
-- =====================================================================
