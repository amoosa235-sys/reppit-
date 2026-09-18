-- =====================================================================
-- Reppit — v2c step 8 follow-on to 003/004: Enterprise subscription
-- support.
--
-- Not part of the provided migration set. Neither 003 nor 004 added any
-- RLS to enterprise_plans/enterprise_subscriptions/
-- enterprise_subscription_areas (same recurring gap as every other
-- provided migration's new tables), and there's no column anywhere to
-- store the Paystack plan/subscription identifiers real recurring
-- billing needs.
--
-- Run after 003 and 004.
-- =====================================================================

alter table public.enterprise_plans enable row level security;

-- Small reference table (4 rows, pricing) - public select like
-- token_packs. Pricing/plan-code changes happen via SQL, not client
-- writes, so no insert/update policy.
create policy enterprise_plans_select on public.enterprise_plans
  for select using (true);

alter table public.enterprise_subscriptions enable row level security;

create policy enterprise_subscriptions_select on public.enterprise_subscriptions
  for select using (public.is_admin() or business_user_id = auth.uid());

create policy enterprise_subscriptions_insert_own on public.enterprise_subscriptions
  for insert with check (
    business_user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'business')
  );

-- No client update policy: status/current_period_end/paystack_* columns
-- only change via activate_enterprise_subscription() (payment) or
-- direct admin/service-role action (cancellation, disputes) - a business
-- must never be able to mark its own subscription active without
-- actually paying.

alter table public.enterprise_subscription_areas enable row level security;

create policy enterprise_subscription_areas_select on public.enterprise_subscription_areas
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enterprise_subscriptions s
      where s.id = subscription_id and s.business_user_id = auth.uid()
    )
  );

-- Claiming/releasing an area is a plain insert/delete by the owning
-- business - area_limit is enforced in the claimArea server action
-- (it depends on the plan looked up at claim-time, same as the
-- provided migration's own comment says), not in SQL.
create policy enterprise_subscription_areas_insert_own on public.enterprise_subscription_areas
  for insert with check (
    exists (
      select 1 from public.enterprise_subscriptions s
      where s.id = subscription_id and s.business_user_id = auth.uid()
    )
  );

create policy enterprise_subscription_areas_delete_own on public.enterprise_subscription_areas
  for delete using (
    exists (
      select 1 from public.enterprise_subscriptions s
      where s.id = subscription_id and s.business_user_id = auth.uid()
    )
  );

alter table public.enterprise_plans add column if not exists paystack_plan_code text;
alter table public.enterprise_subscriptions add column if not exists paystack_subscription_code text;

-- Unlike orders (paid once) or provider_subscriptions (one annual charge
-- to verify), an Enterprise subscription is charged monthly - each
-- renewal has its own, distinct Paystack reference, and each one should
-- extend the period exactly once. A single "paystack_reference" column
-- on enterprise_subscriptions can't express that (it can only remember
-- the *last* reference, not "have I seen this one before"), so this is
-- a small append-only payment log instead, with the uniqueness
-- constraint doing the idempotency work reference by reference.
create table if not exists public.enterprise_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.enterprise_subscriptions (id) on delete cascade,
  paystack_reference text not null unique,
  created_at timestamptz not null default now()
);

alter table public.enterprise_subscription_payments enable row level security;

create policy enterprise_subscription_payments_select on public.enterprise_subscription_payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.enterprise_subscriptions s
      where s.id = subscription_id and s.business_user_id = auth.uid()
    )
  );

-- Marks a trial (or lapsed) subscription active and extends the paid
-- period by one month. Called for both the initial subscribe charge and
-- every monthly renewal charge - each call's p_reference is logged in
-- enterprise_subscription_payments first; the unique constraint there
-- makes a duplicate call for the *same* reference (callback + webhook
-- both firing) a no-op, while a *new* reference each month legitimately
-- extends the period again.
create or replace function public.activate_enterprise_subscription(
  p_reference text,
  p_subscription_id uuid,
  p_paystack_subscription_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into enterprise_subscription_payments (subscription_id, paystack_reference)
  values (p_subscription_id, p_reference)
  on conflict (paystack_reference) do nothing;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    return false;
  end if;

  update enterprise_subscriptions
  set status = 'active',
      current_period_end = (now() + interval '1 month')::date,
      paystack_subscription_code = coalesce(paystack_subscription_code, p_paystack_subscription_code)
  where id = p_subscription_id;

  return true;
end;
$$;

revoke execute on function public.activate_enterprise_subscription(text, uuid, text) from public;
