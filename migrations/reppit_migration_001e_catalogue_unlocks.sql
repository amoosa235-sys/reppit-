-- =====================================================================
-- Reppit — v2a step 3 follow-on: catalogue unlocking.
--
-- Not part of the provided migration set. Closes the gap flagged when
-- 001b was filed: it added a nullable unlocks.catalogue_id but left
-- unlocks.provider_id NOT NULL from v1, with no constraint tying the
-- two together - a catalogue-only unlock could not be inserted. Also
-- extends the RLS policies that assumed every unlock was provider-based
-- (contact reveal, messaging) to cover the catalogue case.
--
-- Run after 001b and 001d.
-- =====================================================================

alter table public.unlocks
  alter column provider_id drop not null;

alter table public.unlocks
  add constraint unlocks_target_check check (
    (provider_id is not null and catalogue_id is null) or
    (provider_id is null and catalogue_id is not null)
  );

-- uq_unlocks_provider (unique(business_id, provider_id)) already only
-- enforces uniqueness among rows where provider_id is non-null - nulls
-- are never equal in a unique constraint - so it's unaffected by
-- catalogue-only rows. It needs a matching partial index for the
-- catalogue side, which a plain column-pair unique constraint can't do.
create unique index uq_unlocks_catalogue on public.unlocks (business_id, catalogue_id)
  where catalogue_id is not null;

-- unlocks_select: extend to also cover the catalogue owner's view of
-- their catalogue's unlocks (mirrors the provider_profiles clause).
drop policy if exists unlocks_select on public.unlocks;
create policy unlocks_select on public.unlocks
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or exists (select 1 from public.provider_profiles p where p.id = provider_id and p.user_id = auth.uid())
    or exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
  );

-- users_select_via_unlock only joined through provider_profiles, so a
-- catalogue unlock revealed no contact info at all. Added as a second,
-- separate policy (permissive SELECT policies on the same table are
-- OR'd together) rather than folding into the existing one, since the
-- catalogue owner is looked up directly via catalogues.business_user_id
-- rather than through a provider_profiles join.
create policy users_select_via_catalogue_unlock on public.users
  for select using (
    exists (
      select 1 from public.unlocks u
      join public.businesses b on b.id = u.business_id
      join public.catalogues c on c.id = u.catalogue_id
      where (b.user_id = auth.uid() and c.business_user_id = users.id)
         or (c.business_user_id = auth.uid() and b.user_id = users.id)
    )
  );

-- messages_insert: extend the unlock-linked branch to also recognize a
-- catalogue unlock's counterpart. Order-linked and engagement-linked
-- messaging (migrations 002/004 add the columns and widen
-- messages_target_check, but neither touches this policy) still have no
-- working insert path - that's a gap for when those features get built,
-- not fixed here.
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
    )
  );

-- Atomically charges a business for unlocking a catalogue and records
-- the unlock, or - if that pair is already unlocked - charges nothing.
-- Same idempotent locking pattern as spend_tokens_for_unlock, targeting
-- catalogue_id and uq_unlocks_catalogue instead of provider_id and
-- uq_unlocks_provider.
--
-- Called directly by the authenticated business user (app/catalogues/
-- actions.ts) via supabase.rpc(), same as spend_tokens_for_unlock, so
-- `authenticated` keeps EXECUTE and the ownership check below is
-- load-bearing (a caller could otherwise pass any business_id).
create or replace function public.spend_tokens_for_catalogue_unlock(
  p_business_id uuid,
  p_catalogue_id uuid,
  p_tokens int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
  v_count int;
begin
  if not exists (
    select 1 from businesses where id = p_business_id and user_id = auth.uid()
  ) then
    raise exception 'not_your_business';
  end if;

  select balance into v_balance
  from token_balances
  where business_id = p_business_id
  for update;

  if v_balance is null or v_balance < p_tokens then
    raise exception 'insufficient_tokens';
  end if;

  -- uq_unlocks_catalogue is a partial unique INDEX, not a named
  -- constraint, so it's targeted by its column list + predicate here
  -- rather than "on conflict on constraint" (which only matches actual
  -- constraints, not plain unique indexes).
  insert into unlocks (business_id, catalogue_id, tokens_spent)
  values (p_business_id, p_catalogue_id, p_tokens)
  on conflict (business_id, catalogue_id) where catalogue_id is not null do nothing;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    return false;
  end if;

  update token_balances set balance = balance - p_tokens where business_id = p_business_id;

  insert into token_transactions (business_id, type, token_count, unlock_id)
  select p_business_id, 'spend', p_tokens, u.id
  from unlocks u
  where u.business_id = p_business_id and u.catalogue_id = p_catalogue_id;

  return true;
end;
$$;

-- Supabase grants EXECUTE on every new public-schema function to anon and
-- authenticated directly, not only via the `public` pseudo-role - revoke
-- from anon explicitly (authenticated keeps EXECUTE; guarded above).
revoke execute on function public.spend_tokens_for_catalogue_unlock(uuid, uuid, int) from public, anon;
