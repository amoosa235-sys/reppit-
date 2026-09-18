-- =====================================================================
-- Reppit — Phase 2 migration: order lifecycle, payments, delivery,
-- order-linked communication.
--
-- NOT part of the v1 build (reps + printers, no catalogues/orders).
-- Run this when you start building the catalogue/orders phase.
-- Safe to run once; uses IF NOT EXISTS / idempotent patterns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- New enums
-- ---------------------------------------------------------------------
create type payment_method as enum ('paystack', 'eft_manual');
create type payment_status as enum ('unpaid', 'pending_proof', 'paid', 'disputed');
create type order_stage as enum (
  'pending', 'payment_pending', 'payment_confirmed',
  'in_progress', 'dispatched', 'delivered', 'completed',
  'disputed', 'cancelled'
);

-- ---------------------------------------------------------------------
-- Rebuild `orders` to support BOTH catalogue orders (product purchase)
-- and provider orders (a commissioned job — e.g. a print run, a
-- merchandising project) via the same generalized pattern used for
-- `unlocks`. If you already created the v1 `orders` table from
-- reppit_schema.sql, drop and recreate it here (it wasn't in use by
-- the v1 build, so this is safe).
-- ---------------------------------------------------------------------
drop table if exists orders cascade;

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references users(id),

  -- exactly one of these two is set, same pattern as unlocks
  catalogue_id uuid references catalogues(id),
  provider_profile_id uuid references provider_profiles(id),

  description text,                     -- scope of work for a provider order; optional for catalogue orders
  items jsonb default '[]',             -- [{catalogue_item_id, quantity, unit_price}, ...] for catalogue orders
  quantity numeric,
  price_total numeric,
  currency text not null default 'ZAR', -- ready for multi-currency SADC expansion

  payment_method payment_method,
  payment_status payment_status not null default 'unpaid',
  proof_of_payment_url text,
  payment_confirmed_by uuid references users(id),
  payment_confirmed_at timestamptz,

  stage order_stage not null default 'pending',

  delivery_confirmed_at timestamptz,
  delivery_confirmed_by uuid references users(id),
  delivery_notes text,

  created_at timestamptz not null default now(),

  constraint orders_seller_check check (
    (catalogue_id is not null and provider_profile_id is null) or
    (catalogue_id is null and provider_profile_id is not null)
  )
);
create index idx_orders_buyer on orders (buyer_user_id);
create index idx_orders_catalogue on orders (catalogue_id);
create index idx_orders_provider on orders (provider_profile_id);
create index idx_orders_stage on orders (stage);

-- ---------------------------------------------------------------------
-- Order status history — the "project progress" timeline
-- ---------------------------------------------------------------------
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  stage order_stage not null,
  note text,
  changed_by uuid not null references users(id),
  changed_at timestamptz not null default now()
);
create index idx_order_history_order on order_status_history (order_id);

-- ---------------------------------------------------------------------
-- Extend messages to support order-linked communication, alongside
-- the existing unlock-linked communication. Exactly one of
-- unlock_id / order_id should be set per message.
-- ---------------------------------------------------------------------
alter table messages
  add column if not exists order_id uuid references orders(id) on delete cascade,
  alter column unlock_id drop not null;

alter table messages
  add constraint messages_target_check check (
    (unlock_id is not null and order_id is null) or
    (unlock_id is null and order_id is not null)
  );
create index if not exists idx_messages_order on messages (order_id);

-- =====================================================================
-- Notes:
-- 1. `payment_status = 'pending_proof'` is the state after a buyer
--    uploads a proof-of-payment document for a manual EFT order,
--    before the seller (or an admin) confirms it as paid.
-- 2. Provider orders (jobs, not products) reuse this same table —
--    e.g. a print job: buyer creates an order against a printer's
--    provider_profile_id, agrees a price_total, pays, tracks stage
--    through to delivered/completed.
-- 3. Reppit facilitates tracking/communication here but remains a
--    facilitator, not a party to the underlying transaction — keep
--    this consistent with the ToS liability language.
-- =====================================================================
