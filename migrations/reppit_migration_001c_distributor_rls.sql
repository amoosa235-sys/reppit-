-- =====================================================================
-- Reppit — v2a step 1 follow-on to 001b: distributor category support.
--
-- Not part of the provided migration set - authored while building the
-- distributor category feature to fill two gaps 001b left open:
-- 1. provider_profiles.category's check constraint still only allows
--    'rep'/'printer' (from v1) - distributor_details exists but no
--    provider profile could actually declare category = 'distributor'.
-- 2. distributor_details was created without RLS enabled at all, unlike
--    rep_details/printer_details - as it stood, it had no access policy
--    restricting who can read/write it.
--
-- Run after 001b, before/alongside starting on the distributor UI.
-- =====================================================================

alter table public.provider_profiles
  drop constraint provider_profiles_category_check;

alter table public.provider_profiles
  add constraint provider_profiles_category_check
  check (category in ('rep', 'printer', 'distributor'));

alter table public.distributor_details enable row level security;

create policy distributor_details_select_all on public.distributor_details
  for select using (true);

create policy distributor_details_insert_own on public.distributor_details
  for insert with check (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_profile_id and p.user_id = auth.uid()
    )
  );

create policy distributor_details_update_own on public.distributor_details
  for update using (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_profile_id and p.user_id = auth.uid()
    )
  );
