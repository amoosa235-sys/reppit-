-- =====================================================================
-- Reppit — v2d follow-on to 004: Team Management Dashboard support.
--
-- Not part of the provided migration set. 004 defined engagements,
-- store_returns, refunds, damages, stock_reports, marketing_campaigns,
-- and marketing_assets with no RLS at all (same recurring gap as every
-- other provided migration's new tables), added messages.engagement_id
-- but never extended messages_insert to recognize it, and "gated in
-- application logic" (004's own note) has no actual gate to call -
-- this adds one.
--
-- Run after 004.
-- =====================================================================

-- Whether a business (by user id) currently has Enterprise access -
-- trial counts here, unlike the token-discount check in
-- lib/enterprise-discount.ts, per the brief's own wording ("active/
-- trialling Enterprise subscription" for gating the dashboard, vs.
-- "the subscription is 'active'" specifically for token discounts).
create or replace function public.has_enterprise_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from enterprise_subscriptions
    where business_user_id = p_user_id and status in ('trial', 'active')
  );
$$;

-- Same check, reached from a child table (store_returns, stock_reports,
-- ...) via its engagement rather than directly from a business_user_id -
-- the actor inserting a child row is often the provider (e.g. a
-- merchandiser filing a stock report), who has no enterprise_subscriptions
-- row of their own and no RLS visibility into the business's one, so this
-- has to be security definer rather than expressed as a plain policy
-- join.
create or replace function public.engagement_has_enterprise_access(p_engagement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from engagements e
    join enterprise_subscriptions s on s.business_user_id = e.business_user_id
    where e.id = p_engagement_id and s.status in ('trial', 'active')
  );
$$;

alter table public.engagements enable row level security;

create policy engagements_select on public.engagements
  for select using (
    public.is_admin()
    or business_user_id = auth.uid()
    or exists (select 1 from public.provider_profiles p where p.id = provider_profile_id and p.user_id = auth.uid())
  );

create policy engagements_insert on public.engagements
  for insert with check (
    business_user_id = auth.uid()
    and public.has_enterprise_access(auth.uid())
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'business')
  );

create policy engagements_update on public.engagements
  for update using (
    public.is_admin()
    or business_user_id = auth.uid()
    or exists (select 1 from public.provider_profiles p where p.id = provider_profile_id and p.user_id = auth.uid())
  );

-- Shared shape for the four "child of an engagement" tables: visible to
-- either party of the engagement, insertable by either party but only
-- while the business side still has Enterprise access, updatable by
-- either party (server actions narrow who may set which fields/status
-- transitions - same division of labour as orders' RLS/action split).
do $$
declare
  t text;
begin
  foreach t in array array['store_returns', 'damages', 'stock_reports'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      create policy %1$I_select on public.%1$I
        for select using (
          public.is_admin()
          or exists (
            select 1 from public.engagements e
            left join public.provider_profiles p on p.id = e.provider_profile_id
            where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
          )
        )
    $f$, t);

    execute format($f$
      create policy %1$I_insert on public.%1$I
        for insert with check (
          reported_by = auth.uid()
          and public.engagement_has_enterprise_access(engagement_id)
          and exists (
            select 1 from public.engagements e
            left join public.provider_profiles p on p.id = e.provider_profile_id
            where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
          )
        )
    $f$, t);

    execute format($f$
      create policy %1$I_update on public.%1$I
        for update using (
          public.is_admin()
          or exists (
            select 1 from public.engagements e
            left join public.provider_profiles p on p.id = e.provider_profile_id
            where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
          )
        )
    $f$, t);
  end loop;
end $$;

alter table public.refunds enable row level security;

create policy refunds_select on public.refunds
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy refunds_insert on public.refunds
  for insert with check (
    public.engagement_has_enterprise_access(engagement_id)
    and exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- Approving/rejecting/marking paid is a business decision - unlike the
-- three tables above, only the business side (or admin) may update a
-- refund once filed.
create policy refunds_update on public.refunds
  for update using (
    public.is_admin()
    or exists (select 1 from public.engagements e where e.id = engagement_id and e.business_user_id = auth.uid())
  );

alter table public.marketing_campaigns enable row level security;

create policy marketing_campaigns_select on public.marketing_campaigns
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy marketing_campaigns_insert on public.marketing_campaigns
  for insert with check (
    public.engagement_has_enterprise_access(engagement_id)
    and exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy marketing_campaigns_update on public.marketing_campaigns
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

alter table public.marketing_assets enable row level security;

create policy marketing_assets_select on public.marketing_assets
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.marketing_campaigns c
      join public.engagements e on e.id = c.engagement_id
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where c.id = campaign_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy marketing_assets_insert on public.marketing_assets
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.marketing_campaigns c
      join public.engagements e on e.id = c.engagement_id
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where c.id = campaign_id
        and public.engagement_has_enterprise_access(e.id)
        and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- messages_insert (last extended for orders) still had no branch
-- recognizing engagement_id, despite the column and the 3-way
-- messages_target_check existing since 004.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.unlocks u
        join public.businesses b on b.id = u.business_id
        join public.provider_profiles p on p.id = u.provider_id
        where u.id = unlock_id
          and (
            (b.user_id = auth.uid() and p.user_id = recipient_id)
            or (p.user_id = auth.uid() and b.user_id = recipient_id)
          )
      )
      or exists (
        select 1 from public.unlocks u
        join public.businesses b on b.id = u.business_id
        join public.catalogues c on c.id = u.catalogue_id
        where u.id = unlock_id
          and (
            (b.user_id = auth.uid() and c.business_user_id = recipient_id)
            or (c.business_user_id = auth.uid() and b.user_id = recipient_id)
          )
      )
      or exists (
        select 1 from public.orders o
        left join public.catalogues c on c.id = o.catalogue_id
        left join public.provider_profiles p on p.id = o.provider_profile_id
        where o.id = order_id
          and (
            (o.buyer_user_id = auth.uid() and (c.business_user_id = recipient_id or p.user_id = recipient_id))
            or ((c.business_user_id = auth.uid() or p.user_id = auth.uid()) and o.buyer_user_id = recipient_id)
          )
      )
      or exists (
        select 1 from public.engagements e
        left join public.provider_profiles p on p.id = e.provider_profile_id
        where e.id = engagement_id
          and (
            (e.business_user_id = auth.uid() and p.user_id = recipient_id)
            or (p.user_id = auth.uid() and e.business_user_id = recipient_id)
          )
      )
    )
  );

-- ---------------------------------------------------------------------
-- Storage: damage photos, stock report photos, marketing assets - one
-- bucket, keyed by "<engagement_id>/<file>" (marketing assets nest a
-- campaign under that: "<engagement_id>/marketing/<campaign_id>-<file>"),
-- private - only the engagement's two parties (or admin) can read.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-management',
  'team-management',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- storage.objects.name qualified explicitly: provider_profiles also has a
-- `name` column, so the unqualified form is ambiguous once it's joined
-- into this subquery's scope (same issue fixed in 002a's order_proofs_select).
create policy team_management_select on storage.objects
  for select using (
    bucket_id = 'team-management'
    and exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (public.is_admin() or e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy team_management_insert on storage.objects
  for insert with check (
    bucket_id = 'team-management'
    and exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id::text = (storage.foldername(storage.objects.name))[1]
        and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );
