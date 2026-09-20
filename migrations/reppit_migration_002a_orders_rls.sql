-- =====================================================================
-- Reppit — v2a step 4 follow-on to 002: orders support.
--
-- Not part of the provided migration set. 002 defines orders and
-- order_status_history with no RLS at all (same pattern as 001b's
-- catalogues/distributor_details before their follow-on fixes), adds
-- messages.order_id but never extends messages_insert to recognize it,
-- and has no column to make a Paystack order payment idempotent the
-- way token/subscription purchases are.
--
-- Run after 002.
-- =====================================================================

alter table public.orders enable row level security;

-- Buyer and either seller side (catalogue owner or provider) can see an
-- order; nobody else. There's no public "order browsing" - unlike
-- catalogues/provider_profiles, an order is a private transaction.
create policy orders_select on public.orders
  for select using (
    public.is_admin()
    or buyer_user_id = auth.uid()
    or exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
    or exists (select 1 from public.provider_profiles p where p.id = provider_profile_id and p.user_id = auth.uid())
  );

create policy orders_insert on public.orders
  for insert with check (
    buyer_user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'business')
  );

-- Both buyer and seller can update a row they're party to (which specific
-- fields each side is allowed to change - stage, payment confirmation,
-- proof upload - is enforced by the server actions that call this, not
-- by RLS; RLS only gates who may touch the row at all).
create policy orders_update on public.orders
  for update using (
    public.is_admin()
    or buyer_user_id = auth.uid()
    or exists (select 1 from public.catalogues c where c.id = catalogue_id and c.business_user_id = auth.uid())
    or exists (select 1 from public.provider_profiles p where p.id = provider_profile_id and p.user_id = auth.uid())
  );

alter table public.order_status_history enable row level security;

create policy order_status_history_select on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      left join public.catalogues c on c.id = o.catalogue_id
      left join public.provider_profiles p on p.id = o.provider_profile_id
      where o.id = order_id
        and (public.is_admin() or o.buyer_user_id = auth.uid() or c.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy order_status_history_insert on public.order_status_history
  for insert with check (
    changed_by = auth.uid()
    and exists (
      select 1 from public.orders o
      left join public.catalogues c on c.id = o.catalogue_id
      left join public.provider_profiles p on p.id = o.provider_profile_id
      where o.id = order_id
        and (o.buyer_user_id = auth.uid() or c.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- Same reasoning as users_select_via_unlock/users_select_via_catalogue_unlock:
-- an order doesn't otherwise reveal either party's contact info. In this
-- app's flow every order originates from an existing unlock (so contact
-- is already visible via those policies), but that's a UI convention, not
-- something RLS should quietly depend on - an order-based policy stands
-- on its own regardless of whether the originating unlock still exists.
create policy users_select_via_order on public.users
  for select using (
    exists (
      select 1 from public.orders o
      left join public.catalogues c on c.id = o.catalogue_id
      left join public.provider_profiles p on p.id = o.provider_profile_id
      where (o.buyer_user_id = auth.uid() and (c.business_user_id = users.id or p.user_id = users.id))
         or ((c.business_user_id = auth.uid() or p.user_id = auth.uid()) and o.buyer_user_id = users.id)
    )
  );

-- messages_insert (last extended for catalogue unlocks) still had no
-- branch recognizing order_id at all - an order-linked message could
-- never actually be inserted despite the column and messages_target_check
-- existing since 002. Adds that branch; the same order/engagement gap
-- noted before still applies to engagement_id, left for v2d.
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
    )
  );

-- ---------------------------------------------------------------------
-- Storage: EFT proof-of-payment documents - private, keyed by
-- "<order_id>/<file>" (not "<user_id>/<file>" like the other buckets,
-- since access here is by order membership - buyer, seller, or admin -
-- not simply by who uploaded it).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-proofs', 'order-proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy order_proofs_select on storage.objects
  for select using (
    bucket_id = 'order-proofs'
    and exists (
      select 1 from public.orders o
      left join public.catalogues c on c.id = o.catalogue_id
      left join public.provider_profiles p on p.id = o.provider_profile_id
      -- storage.objects.name qualified explicitly: both catalogues and
      -- provider_profiles also have a `name` column, so the unqualified
      -- form is ambiguous once they're joined into this subquery's scope.
      where o.id::text = (storage.foldername(storage.objects.name))[1]
        and (public.is_admin() or o.buyer_user_id = auth.uid() or c.business_user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy order_proofs_insert on storage.objects
  for insert with check (
    bucket_id = 'order-proofs'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1] and o.buyer_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Paystack order payment: needs a reference column to make double
-- verification (callback + webhook) idempotent, same reasoning as
-- token_transactions.paystack_reference / provider_subscriptions
-- .paystack_reference. 002 never added one - EFT-paid orders leave it
-- null, so the unique constraint below only constrains Paystack-paid
-- orders (nulls never conflict).
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists paystack_reference text;
alter table public.orders add constraint orders_paystack_reference_key unique (paystack_reference);

-- Marks an order paid via Paystack exactly once per reference. Unlike
-- record_token_purchase/record_provider_subscription (which INSERT and
-- rely on ON CONFLICT), this UPDATEs an existing order row, so the
-- idempotency gate is "only when paystack_reference is still null" -
-- a second call for the same order/reference matches zero rows and
-- returns false rather than re-applying the update.
create or replace function public.record_order_payment(
  p_reference text,
  p_order_id uuid,
  p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_buyer uuid;
  v_stage order_stage;
begin
  update orders
  set payment_method = 'paystack',
      payment_status = 'paid',
      payment_confirmed_at = now(),
      paystack_reference = p_reference,
      stage = case when stage in ('pending', 'payment_pending') then 'payment_confirmed' else stage end
  where id = p_order_id
    and price_total = p_amount
    and paystack_reference is null;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    return false;
  end if;

  select buyer_user_id, stage into v_buyer, v_stage from orders where id = p_order_id;

  insert into order_status_history (order_id, stage, note, changed_by)
  values (p_order_id, v_stage, 'Payment confirmed via Paystack', v_buyer);

  return true;
end;
$$;

-- Called only from lib/orders.ts via the service-role client, after this
-- codebase's own Paystack verify() call - it does no verification of its
-- own, so direct client access would let a buyer mark any order "paid"
-- for free. Supabase grants EXECUTE on every new public-schema function
-- to anon and authenticated directly (not only via the `public`
-- pseudo-role), so both need an explicit revoke here.
revoke execute on function public.record_order_payment(text, uuid, numeric) from public, anon, authenticated;

revoke execute on function public.record_order_payment(text, uuid, numeric) from public;
