-- =====================================================================
-- Reppit v2 — payment terms RLS + write RPCs.
--
-- Not part of the provided migration set. `005` shipped
-- `engagement_payment_terms` with RLS entirely off (same recurring gap
-- as every other provided migration's new tables) and no policies or
-- functions to gate who can set what.
--
-- Unlike the other v2d tables (campaigns, stock reports, returns...)
-- where either side of the engagement may reasonably write a row, this
-- table mixes two different kinds of writes with different rightful
-- owners:
--   - payment_type / commission_pct / retainer_amount / frequency is
--     the commercial term the business is offering — set by the
--     business side.
--   - paystack_recipient_code / recipient_added_at is the provider's
--     own bank-account reference, returned by Paystack's Transfer
--     Recipient API against the provider's own banking details — only
--     the provider should ever be able to write it, or a business
--     could silently redirect a provider's future payout reference.
-- Row-level UPDATE policies can't restrict individual columns, so both
-- writes go through security-definer RPCs instead of a plain
-- update policy, each independently checking caller identity against
-- the engagement and requiring the engagement still has (active or
-- trialling) Enterprise access, same gate already used for every other
-- v2d insert. There is no plain insert/update policy on this table at
-- all — every write goes through one of the two functions below.
--
-- Run after `005` (and `004a`, for `engagement_has_enterprise_access`).
-- =====================================================================

alter table public.engagement_payment_terms enable row level security;

create policy engagement_payment_terms_select on public.engagement_payment_terms
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.engagements e
      left join public.provider_profiles p on p.id = e.provider_profile_id
      where e.id = engagement_id and (e.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create or replace function public.set_engagement_payment_terms(
  p_engagement_id uuid,
  p_payment_type payment_type,
  p_commission_pct numeric,
  p_retainer_amount numeric,
  p_frequency payment_frequency
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_user_id uuid;
begin
  select business_user_id into v_business_user_id
  from public.engagements
  where id = p_engagement_id;

  if v_business_user_id is null then
    raise exception 'Engagement not found';
  end if;

  if v_business_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the business side of the engagement can set payment terms';
  end if;

  if not public.engagement_has_enterprise_access(p_engagement_id) then
    raise exception 'Engagement does not have Enterprise access';
  end if;

  if p_payment_type = 'commission' and p_commission_pct is null then
    raise exception 'commission_pct is required for commission payment terms';
  end if;

  if p_payment_type = 'retainer' and p_retainer_amount is null then
    raise exception 'retainer_amount is required for retainer payment terms';
  end if;

  insert into public.engagement_payment_terms (
    engagement_id, payment_type, commission_pct, retainer_amount, frequency
  )
  values (
    p_engagement_id, p_payment_type, p_commission_pct, p_retainer_amount, p_frequency
  )
  on conflict (engagement_id) do update set
    payment_type = excluded.payment_type,
    commission_pct = excluded.commission_pct,
    retainer_amount = excluded.retainer_amount,
    frequency = excluded.frequency;
end;
$$;

create or replace function public.set_engagement_payment_recipient(
  p_engagement_id uuid,
  p_recipient_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_user_id uuid;
begin
  select p.user_id into v_provider_user_id
  from public.engagements e
  join public.provider_profiles p on p.id = e.provider_profile_id
  where e.id = p_engagement_id;

  if v_provider_user_id is null then
    raise exception 'Engagement not found';
  end if;

  if v_provider_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the provider side of the engagement can register a payout recipient';
  end if;

  if not public.engagement_has_enterprise_access(p_engagement_id) then
    raise exception 'Engagement does not have Enterprise access';
  end if;

  update public.engagement_payment_terms
  set paystack_recipient_code = p_recipient_code,
      recipient_added_at = now()
  where engagement_id = p_engagement_id;

  if not found then
    raise exception 'Payment terms must be set by the business before a recipient can be registered';
  end if;
end;
$$;
