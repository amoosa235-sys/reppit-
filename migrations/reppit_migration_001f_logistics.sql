-- =====================================================================
-- Reppit — v2b step 5/6/7 follow-on to 001b: logistics support.
--
-- Not part of the provided migration set. 001b created distribution_hubs,
-- consolidated_loads, and load_bookings with RLS off entirely (same
-- pattern as distributor_details/catalogues before their fixes), and
-- provider_profiles.category still doesn't allow a logistics provider
-- to declare itself.
--
-- Design call: there's no separate "logistics_details" table in any
-- migration provided, unlike rep/printer/distributor. distribution_hubs
-- already has operator_provider_id -> provider_profiles(id), name,
-- location_id, and routes_served - that IS the logistics provider's
-- operational profile (hub location + routes), not something needing a
-- second 1:1 table. A provider may operate more than one hub (nothing
-- in the schema restricts operator_provider_id to unique), which is
-- realistic for a logistics company running multiple depots.
--
-- Run after 001b.
-- =====================================================================

alter table public.provider_profiles
  drop constraint provider_profiles_category_check;

alter table public.provider_profiles
  add constraint provider_profiles_category_check
  check (category in ('rep', 'printer', 'distributor', 'logistics'));

alter table public.distribution_hubs enable row level security;

-- Hubs are publicly browsable (need to be, to browse consolidated_loads
-- meaningfully), owner-managed - same visibility shape as
-- provider_profiles/catalogues.
create policy distribution_hubs_select on public.distribution_hubs
  for select using (true);

create policy distribution_hubs_insert_own on public.distribution_hubs
  for insert with check (
    exists (
      select 1 from public.provider_profiles p
      where p.id = operator_provider_id and p.user_id = auth.uid() and p.category = 'logistics'
    )
  );

create policy distribution_hubs_update_own on public.distribution_hubs
  for update using (
    exists (
      select 1 from public.provider_profiles p
      where p.id = operator_provider_id and p.user_id = auth.uid()
    )
  );

alter table public.consolidated_loads enable row level security;

create policy consolidated_loads_select on public.consolidated_loads
  for select using (true);

create policy consolidated_loads_insert_own on public.consolidated_loads
  for insert with check (
    exists (
      select 1 from public.distribution_hubs h
      join public.provider_profiles p on p.id = h.operator_provider_id
      where h.id = hub_id and p.user_id = auth.uid()
    )
  );

create policy consolidated_loads_update_own on public.consolidated_loads
  for update using (
    exists (
      select 1 from public.distribution_hubs h
      join public.provider_profiles p on p.id = h.operator_provider_id
      where h.id = hub_id and p.user_id = auth.uid()
    )
  );

alter table public.load_bookings enable row level security;

-- No insert/update policy: writes only happen through book_load() below
-- (security definer), same pattern as token_balances/token_transactions -
-- a business must never be able to fabricate a booking or its token cost
-- directly.
create policy load_bookings_select on public.load_bookings
  for select using (
    public.is_admin()
    or booked_by_user_id = auth.uid()
    or exists (
      select 1 from public.consolidated_loads c
      join public.distribution_hubs h on h.id = c.hub_id
      join public.provider_profiles p on p.id = h.operator_provider_id
      where c.id = load_id and p.user_id = auth.uid()
    )
  );

-- Books a load: locks and checks the business's token balance, locks and
-- checks the load's remaining capacity and 'open' status, then inserts
-- the booking, debits tokens, and bumps capacity_booked (flipping the
-- load to 'full' if that fills it). Unlike spend_tokens_for_unlock/
-- spend_tokens_for_catalogue_unlock, this has no identity-based
-- idempotency gate - load_bookings carries no uniqueness constraint,
-- because a business legitimately booking more space on the same load
-- later is a second row, not a duplicate of the first.
--
-- Called directly by the authenticated business user (app/loads/
-- actions.ts) via supabase.rpc(), so `authenticated` keeps EXECUTE and
-- both ownership checks below are load-bearing: without them a caller
-- could pass any business_id (drain someone else's tokens) or any
-- user_id (attribute the booking to someone else).
create or replace function public.book_load(
  p_business_id uuid,
  p_user_id uuid,
  p_load_id uuid,
  p_quantity numeric,
  p_tokens int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_capacity numeric;
  v_booked numeric;
  v_status load_status;
begin
  if p_user_id <> auth.uid() then
    raise exception 'not_your_user_id';
  end if;

  if not exists (
    select 1 from businesses where id = p_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_your_business';
  end if;

  select balance into v_balance from token_balances where business_id = p_business_id for update;

  if v_balance is null or v_balance < p_tokens then
    raise exception 'insufficient_tokens';
  end if;

  select capacity, capacity_booked, status into v_capacity, v_booked, v_status
  from consolidated_loads where id = p_load_id for update;

  if v_status is null or v_status <> 'open' then
    raise exception 'load_not_open';
  end if;

  if v_capacity is not null and v_booked + p_quantity > v_capacity then
    raise exception 'insufficient_capacity';
  end if;

  insert into load_bookings (load_id, booked_by_user_id, quantity, tokens_spent)
  values (p_load_id, p_user_id, p_quantity, p_tokens);

  update consolidated_loads
  set capacity_booked = capacity_booked + p_quantity,
      status = case
        when capacity is not null and capacity_booked + p_quantity >= capacity then 'full'
        else status
      end
  where id = p_load_id;

  update token_balances set balance = balance - p_tokens where business_id = p_business_id;

  insert into token_transactions (business_id, type, token_count)
  values (p_business_id, 'spend', p_tokens);

  return true;
end;
$$;

-- Supabase grants EXECUTE on every new public-schema function to anon and
-- authenticated directly, not only via the `public` pseudo-role - revoke
-- from anon explicitly (authenticated keeps EXECUTE; guarded above).
revoke execute on function public.book_load(uuid, uuid, uuid, numeric, int) from public, anon;

-- ---------------------------------------------------------------------
-- distribution_hubs.location_id is a hard FK to locations(id) - unlike
-- provider_profiles/businesses, which just use free-text province/town
-- columns per v1's "simple text input, defer full locality dataset"
-- decision. locations has existed since v1 as an unused reference table
-- (public select policy only, no insert policy - nothing wrote to it
-- yet). This keeps the hub form itself as plain province/town text
-- inputs, matching the rest of the app, while satisfying the FK:
-- resolve-or-create the matching locations row behind the scenes.
-- Safe to expose to any authenticated caller (harmless reference-data
-- upsert, not execute-restricted like the token/booking functions) -
-- but not to anon, so revoked there below.
-- ---------------------------------------------------------------------
create or replace function public.get_or_create_location(p_province text, p_town text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into locations (province, town)
  values (p_province, p_town)
  on conflict (province, town) do nothing;

  select id into v_id from locations where province = p_province and town = p_town;
  return v_id;
end;
$$;

revoke execute on function public.get_or_create_location(text, text) from public, anon;
