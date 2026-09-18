-- =====================================================================
-- Reppit — Phase 4 migration: Team Management Dashboard.
--
-- Unlocked for businesses on an active (or trialling) Enterprise
-- subscription. Turns a one-off "unlock" into an ongoing working
-- relationship (`engagement`), and gives the business a dashboard to
-- run their outsourced sales rep / merchandiser / marketing team
-- through the app: orders, returns, refunds, damages, stock reports,
-- shelf photos, campaigns, and communication, all in one place.
--
-- Depends on: phase 2 (orders) and phase 3 (enterprise_subscriptions)
-- already being live. Not part of v1.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Add a free trial state to Enterprise subscriptions
-- ---------------------------------------------------------------------
alter type enterprise_status add value if not exists 'trial';
alter table enterprise_subscriptions
  add column if not exists trial_ends_at date;

-- ---------------------------------------------------------------------
-- Engagements — an ongoing working relationship between a business
-- and a provider, started after an unlock. This is what the
-- management dashboard is organized around.
-- ---------------------------------------------------------------------
create type engagement_status as enum ('active', 'paused', 'ended');

create table engagements (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references users(id),
  provider_profile_id uuid not null references provider_profiles(id),
  unlock_id uuid references unlocks(id),   -- the discovery event that led here, if any
  status engagement_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text
);
create index idx_engagements_business on engagements (business_user_id);
create index idx_engagements_provider on engagements (provider_profile_id);

-- Let messages attach to an engagement too (the ongoing thread),
-- alongside the existing unlock_id / order_id targets.
alter table messages
  add column if not exists engagement_id uuid references engagements(id) on delete cascade;
alter table messages drop constraint if exists messages_target_check;
alter table messages add constraint messages_target_check check (
  (case when unlock_id is not null then 1 else 0 end
   + case when order_id is not null then 1 else 0 end
   + case when engagement_id is not null then 1 else 0 end) = 1
);
create index if not exists idx_messages_engagement on messages (engagement_id);

-- ---------------------------------------------------------------------
-- 1) Sales rep module: store returns, refunds, damages
--    (orders + area coverage already covered by `orders` and
--    `rep_details.covered_towns` / coverage_scope from earlier phases)
-- ---------------------------------------------------------------------
create type return_status as enum ('reported', 'processing', 'resolved');
create table store_returns (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  order_id uuid references orders(id),
  store_location text,
  product_name text,
  quantity numeric,
  reason text,
  status return_status not null default 'reported',
  reported_by uuid not null references users(id),
  reported_at timestamptz not null default now()
);
create index idx_returns_engagement on store_returns (engagement_id);

create type refund_status as enum ('pending', 'approved', 'rejected', 'paid');
create table refunds (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  order_id uuid references orders(id),
  amount numeric not null,
  reason text,
  status refund_status not null default 'pending',
  processed_by uuid references users(id),
  processed_at timestamptz
);
create index idx_refunds_engagement on refunds (engagement_id);

create table damages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  order_id uuid references orders(id),
  description text,
  photos text[] default '{}',
  reported_by uuid not null references users(id),
  reported_at timestamptz not null default now()
);
create index idx_damages_engagement on damages (engagement_id);

-- ---------------------------------------------------------------------
-- 2) Merchandiser module: stock level reporting + shelf photos
-- ---------------------------------------------------------------------
create table stock_reports (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  store_location text,
  product_name text,
  sku text,
  quantity_on_shelf numeric,
  photos text[] default '{}',       -- shelf photos as visual proof of visit
  reported_by uuid not null references users(id),
  reported_at timestamptz not null default now()
);
create index idx_stock_reports_engagement on stock_reports (engagement_id);

-- ---------------------------------------------------------------------
-- 3) Marketing team module: campaigns, costs, promo planning/material
-- ---------------------------------------------------------------------
create type campaign_status as enum ('planned', 'active', 'completed', 'cancelled');
create table marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  name text not null,
  budget numeric,
  cost_actual numeric default 0,
  start_date date,
  end_date date,
  status campaign_status not null default 'planned'
);
create index idx_campaigns_engagement on marketing_campaigns (engagement_id);

create type marketing_asset_type as enum ('design', 'promo_material');
create table marketing_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaigns(id) on delete cascade,
  asset_type marketing_asset_type not null,
  file_url text not null,
  uploaded_by uuid not null references users(id),
  uploaded_at timestamptz not null default now()
);
create index idx_assets_campaign on marketing_assets (campaign_id);

-- =====================================================================
-- Notes:
-- 1. Access to everything in this file is gated in application logic
--    by an active or trialling enterprise_subscriptions row for the
--    business — this migration only builds the data layer.
-- 2. `engagements.provider_profile_id` category (rep/merchandiser/
--    printer) determines which module(s) of the dashboard are
--    relevant to show for that engagement — a "marketing team"
--    engagement is typically with a printer-category provider, since
--    Reppit doesn't have a separate marketing-agency category.
-- 3. This is a substantial module — build order suggestion once you
--    get here: engagements + communication first (ties everything
--    together), then stock_reports (merchandiser, likely highest
--    day-to-day usage), then returns/refunds/damages, then marketing
--    campaigns last.
-- =====================================================================
