-- =====================================================================
-- Reppit — v2 addition: Engagement payment terms (Option A).
--
-- Reference-only: Reppit documents the agreed payment structure
-- between a business and a provider, and shows a calculated
-- "amount owed" from real order data — but no money moves through
-- Reppit. The business pays the provider directly, off-platform.
--
-- Banking details are NEVER stored raw in this database — a provider
-- registers their bank account with Paystack's Transfer Recipient
-- API, and Reppit stores only the returned recipient_code reference.
--
-- Depends on: engagements (migration 004), orders (migration 002).
-- Part of v2, alongside the rest of the Enterprise build.
-- =====================================================================

create type payment_type as enum ('commission', 'retainer');
create type payment_frequency as enum ('per_order', 'weekly', 'monthly');

create table engagement_payment_terms (
  engagement_id uuid primary key references engagements(id) on delete cascade,
  payment_type payment_type not null,
  commission_pct numeric,          -- set if payment_type = 'commission'
  retainer_amount numeric,         -- set if payment_type = 'retainer'
  frequency payment_frequency not null default 'monthly',
  paystack_recipient_code text,    -- reference only — actual bank details live with Paystack
  recipient_added_at timestamptz,
  currency text not null default 'ZAR',
  created_at timestamptz not null default now(),
  constraint payment_terms_check check (
    (payment_type = 'commission' and commission_pct is not null) or
    (payment_type = 'retainer' and retainer_amount is not null)
  )
);

-- =====================================================================
-- Notes:
-- 1. "Amount owed" for a commission engagement is calculated, not
--    stored: sum(orders.price_total) * commission_pct / 100 for
--    orders linked to this engagement within the current period.
--    Calculate in application logic against the `orders` table —
--    don't denormalize it here, it'll go stale.
-- 2. For a retainer engagement, "amount owed" is just retainer_amount
--    per period elapsed since engagement start (or last marked-paid
--    date, if you add a simple "mark as paid" log later).
-- 3. No transfer/payout table exists in this migration on purpose —
--    that's B2 (Paystack subaccounts/split payments, funds never
--    touch Reppit), a v3 candidate once usage data shows businesses
--    want automated payout rather than just documented terms.
-- =====================================================================
