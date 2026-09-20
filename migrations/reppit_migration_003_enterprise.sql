-- =====================================================================
-- Reppit — Phase 3 migration: Enterprise area subscriptions.
--
-- A business subscribes to a tier (area limit), claims specific towns
-- up to that limit, and gets a discounted token rate on unlocks
-- (providers or catalogues) within those claimed areas. Standard
-- token pricing still applies everywhere else.
--
-- Not part of v1. Build once there's real usage data showing which
-- accounts operate at multi-region scale.
-- =====================================================================

create type enterprise_tier as enum ('starter', 'growth', 'scale', 'national');
create type enterprise_status as enum ('active', 'grace', 'lapsed', 'cancelled');

create table enterprise_plans (
  tier enterprise_tier primary key,
  area_limit integer,       -- e.g. starter=5, growth=10, scale=20, national=null (unlimited) - nullable per the seed row below
  price_monthly_zar numeric not null,
  token_discount_pct numeric not null default 50  -- % off standard token cost within claimed areas
);

insert into enterprise_plans (tier, area_limit, price_monthly_zar, token_discount_pct) values
  ('starter', 5, 1500, 50),
  ('growth', 10, 4000, 50),
  ('scale', 20, 8000, 50),
  ('national', null, 20000, 50);  -- area_limit null = no cap (20+ areas)

create table enterprise_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references users(id) on delete cascade,
  tier enterprise_tier not null references enterprise_plans(tier),
  status enterprise_status not null default 'active',
  current_period_end date not null,
  created_at timestamptz not null default now()
);
create index idx_ent_sub_business on enterprise_subscriptions (business_user_id);

-- The specific towns a business has claimed under its subscription,
-- up to its plan's area_limit (enforce the count in application logic
-- at claim-time, since it depends on the plan looked up at runtime).
create table enterprise_subscription_areas (
  subscription_id uuid not null references enterprise_subscriptions(id) on delete cascade,
  location_id uuid not null references locations(id),
  claimed_at timestamptz not null default now(),
  primary key (subscription_id, location_id)
);
create index idx_ent_areas_location on enterprise_subscription_areas (location_id);

-- =====================================================================
-- Application logic (not enforced in SQL):
-- 1. When a business unlocks a provider/catalogue, check whether the
--    provider's (or catalogue owner's) location/coverage overlaps any
--    of the business's currently claimed enterprise_subscription_areas.
-- 2. If yes and the subscription is 'active' -> charge
--    tokens_spent * (1 - token_discount_pct/100), rounded as needed.
-- 3. If no match, or no active subscription -> standard token pricing
--    from the existing tier x coverage matrix applies.
-- 4. A provider covering multiple towns (multi_town/regional/
--    provincial) counts as a match if ANY of its covered towns is a
--    claimed area.
-- =====================================================================
