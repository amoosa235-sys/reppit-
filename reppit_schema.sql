-- Reppit v1 database schema
-- Run this directly against your Supabase Postgres instance (SQL editor or `supabase db execute`).
-- Do not regenerate this file from an ORM; edit it by hand and re-run migrations manually.
--
-- Scope: auth/roles, provider profiles (rep + printer), manual verification,
-- browse/search, token purchases, unlock + messaging, ratings, provider annual fees.
-- Out of scope for v1 (designed for later phases, intentionally omitted here):
-- catalogues, orders, distribution_hubs, consolidated_loads, load_bookings,
-- distributor_details.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Returns true if the calling user (auth.uid()) has the admin role.
-- security definer + fixed search_path so it can read public.users under RLS
-- without being tricked by a caller-controlled search_path.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Users & roles
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('business', 'provider', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Locations (simple province/town reference; full autocomplete deferred)
-- ---------------------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  town text not null,
  created_at timestamptz not null default now(),
  unique (province, town)
);

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  name text not null,
  industry text,
  description text,
  province text,
  town text,
  location_id uuid references public.locations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provider profiles (shared fields) + category-specific detail tables
-- ---------------------------------------------------------------------------

create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  category text not null check (category in ('rep', 'printer')),
  name text not null,
  bio text,
  photos text[] not null default '{}',
  province text,
  town text,
  location_id uuid references public.locations (id),
  tier text not null default 'entry' check (tier in ('entry', 'verified', 'premium')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger provider_profiles_set_updated_at
  before update on public.provider_profiles
  for each row execute function public.set_updated_at();

create index provider_profiles_category_idx on public.provider_profiles (category);
create index provider_profiles_province_town_idx on public.provider_profiles (province, town);
create index provider_profiles_tier_idx on public.provider_profiles (tier);

create table public.rep_details (
  provider_id uuid primary key references public.provider_profiles (id) on delete cascade,
  industries text[] not null default '{}',
  regions_covered text[] not null default '{}',
  years_experience int,
  languages text[] not null default '{}'
);

create table public.printer_details (
  provider_id uuid primary key references public.provider_profiles (id) on delete cascade,
  print_types text[] not null default '{}',
  turnaround_days int,
  equipment text,
  max_print_size text
);

-- ---------------------------------------------------------------------------
-- Manual verification
-- ---------------------------------------------------------------------------

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  storage_path text not null,
  document_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create index verification_documents_provider_idx on public.verification_documents (provider_id);
create index verification_documents_status_idx on public.verification_documents (status);

-- ---------------------------------------------------------------------------
-- Provider annual fee subscriptions (tiered, Paystack)
-- ---------------------------------------------------------------------------

create table public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  tier text not null check (tier in ('entry', 'verified', 'premium')),
  amount_cents int not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled')),
  paystack_reference text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index provider_subscriptions_provider_idx on public.provider_subscriptions (provider_id);

-- ---------------------------------------------------------------------------
-- Tokens: packs, balances, transactions
-- ---------------------------------------------------------------------------

create table public.token_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_count int not null,
  price_cents int not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.token_balances (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger token_balances_set_updated_at
  before update on public.token_balances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Unlocks (business spends tokens to unlock a provider's contact info)
-- ---------------------------------------------------------------------------

create table public.unlocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  tokens_spent int not null,
  unlocked_at timestamptz not null default now(),
  constraint uq_unlocks_provider unique (business_id, provider_id)
);

create index unlocks_provider_idx on public.unlocks (provider_id);

create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('purchase', 'spend', 'refund')),
  token_count int not null,
  token_pack_id uuid references public.token_packs (id),
  unlock_id uuid references public.unlocks (id),
  paystack_reference text,
  created_at timestamptz not null default now()
);

create index token_transactions_business_idx on public.token_transactions (business_id);

-- ---------------------------------------------------------------------------
-- Messages (unlocked business <-> provider)
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  unlock_id uuid not null references public.unlocks (id) on delete cascade,
  sender_id uuid not null references public.users (id),
  recipient_id uuid not null references public.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_unlock_idx on public.messages (unlock_id);

-- ---------------------------------------------------------------------------
-- Ratings (both directions, prompted after an unlock)
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  unlock_id uuid not null references public.unlocks (id) on delete cascade,
  rater_id uuid not null references public.users (id),
  ratee_id uuid not null references public.users (id),
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (unlock_id, rater_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.businesses enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.rep_details enable row level security;
alter table public.printer_details enable row level security;
alter table public.verification_documents enable row level security;
alter table public.provider_subscriptions enable row level security;
alter table public.token_packs enable row level security;
alter table public.token_balances enable row level security;
alter table public.unlocks enable row level security;
alter table public.token_transactions enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;

-- users: read/update own row; admins read all
create policy users_select_own on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_update_own on public.users
  for update using (id = auth.uid());
create policy users_insert_own on public.users
  for insert with check (id = auth.uid());

-- locations: public reference data, readable by anyone signed in
create policy locations_select_all on public.locations
  for select using (true);

-- businesses: owner manages their own row; admins read all
create policy businesses_select_own on public.businesses
  for select using (user_id = auth.uid() or public.is_admin());
create policy businesses_insert_own on public.businesses
  for insert with check (user_id = auth.uid());
create policy businesses_update_own on public.businesses
  for update using (user_id = auth.uid());

-- provider_profiles: publicly browsable (for search); owner manages own; admin manages all
create policy provider_profiles_select_all on public.provider_profiles
  for select using (true);
create policy provider_profiles_insert_own on public.provider_profiles
  for insert with check (user_id = auth.uid());
create policy provider_profiles_update_own on public.provider_profiles
  for update using (user_id = auth.uid() or public.is_admin());

-- rep_details / printer_details: follow the parent provider profile's visibility
create policy rep_details_select_all on public.rep_details
  for select using (true);
create policy rep_details_insert_own on public.rep_details
  for insert with check (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );
create policy rep_details_update_own on public.rep_details
  for update using (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

create policy printer_details_select_all on public.printer_details
  for select using (true);
create policy printer_details_insert_own on public.printer_details
  for insert with check (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );
create policy printer_details_update_own on public.printer_details
  for update using (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

-- verification_documents: provider manages own submissions; admin manages all
create policy verification_documents_select on public.verification_documents
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );
create policy verification_documents_insert_own on public.verification_documents
  for insert with check (
    exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );
create policy verification_documents_update_admin on public.verification_documents
  for update using (public.is_admin());

-- provider_subscriptions: provider reads own; admin manages all; writes happen via service role from the Paystack webhook
create policy provider_subscriptions_select on public.provider_subscriptions
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.provider_profiles p
      where p.id = provider_id and p.user_id = auth.uid()
    )
  );

-- token_packs: public can see active packs; admin sees all
create policy token_packs_select_active on public.token_packs
  for select using (active or public.is_admin());

-- token_balances: business reads own balance; writes happen via service role
create policy token_balances_select_own on public.token_balances
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.businesses b
      where b.id = business_id and b.user_id = auth.uid()
    )
  );

-- unlocks: visible to the unlocking business and the unlocked provider
create policy unlocks_select on public.unlocks
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or exists (select 1 from public.provider_profiles p where p.id = provider_id and p.user_id = auth.uid())
  );

-- token_transactions: business reads own ledger; writes happen via service role
create policy token_transactions_select_own on public.token_transactions
  for select using (
    public.is_admin()
    or exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
  );

-- messages: sender or recipient only
create policy messages_select on public.messages
  for select using (
    public.is_admin() or sender_id = auth.uid() or recipient_id = auth.uid()
  );
create policy messages_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.unlocks u
      left join public.businesses b on b.id = u.business_id
      left join public.provider_profiles p on p.id = u.provider_id
      where u.id = unlock_id and (b.user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- ratings: rater or ratee can read; only the rater can insert their own rating,
-- and only for an unlock they were actually part of
create policy ratings_select on public.ratings
  for select using (
    public.is_admin() or rater_id = auth.uid() or ratee_id = auth.uid()
  );
create policy ratings_insert on public.ratings
  for insert with check (
    rater_id = auth.uid()
    and exists (
      select 1 from public.unlocks u
      left join public.businesses b on b.id = u.business_id
      left join public.provider_profiles p on p.id = u.provider_id
      where u.id = unlock_id and (b.user_id = auth.uid() or p.user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Auth: create the public.users row when someone signs up
-- ---------------------------------------------------------------------------

-- The app passes the chosen role ('business' or 'provider') as auth user
-- metadata on signUp(); this trigger mirrors new auth.users rows into
-- public.users so RLS policies elsewhere can key off role. Admin accounts
-- are not self-service - promote a row to role = 'admin' manually in SQL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'role', 'business'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: provider profile photos
-- ---------------------------------------------------------------------------

-- Public bucket (photos are marketing material shown on public provider
-- profiles). Uploads are keyed by "<user_id>/<file>" so RLS can scope
-- writes to the owning provider without a lookup.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-photos', 'provider-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy provider_photos_read on storage.objects
  for select using (bucket_id = 'provider-photos');

create policy provider_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy provider_photos_update_own on storage.objects
  for update using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy provider_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Storage: manual verification documents
-- ---------------------------------------------------------------------------

-- Private bucket (ID documents, business registration, etc.) - only the
-- owning provider and admins can read. Same "<user_id>/<file>" folder
-- convention as provider-photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy verification_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'verification-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy verification_documents_storage_insert_own on storage.objects
  for insert with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy verification_documents_storage_delete_own on storage.objects
  for delete using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Token purchases (Paystack)
-- ---------------------------------------------------------------------------

-- Postgres NULLs are distinct from each other, so this only enforces
-- uniqueness among purchase rows (which always carry a reference);
-- spend/refund rows stay NULL and are unaffected.
alter table public.token_transactions
  add constraint token_transactions_paystack_reference_key unique (paystack_reference);

-- Atomically records a verified Paystack purchase and credits the
-- business's balance in one step. The unique constraint above makes this
-- idempotent: a reference already recorded returns false instead of
-- crediting twice, so it's safe to call from both the callback redirect
-- and the webhook for the same payment.
--
-- security definer so it can write token_transactions/token_balances
-- despite those tables having no client-facing insert/update policies;
-- execute is revoked from anon/authenticated below so only trusted
-- server code (the service-role client) can call it - a business must
-- never be able to invoke this directly with an arbitrary amount.
create or replace function public.record_token_purchase(
  p_reference text,
  p_business_id uuid,
  p_pack_id uuid,
  p_token_count int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into token_transactions (business_id, type, token_count, token_pack_id, paystack_reference)
  values (p_business_id, 'purchase', p_token_count, p_pack_id, p_reference)
  on conflict (paystack_reference) do nothing;

  get diagnostics v_count = row_count;

  if v_count = 0 then
    return false;
  end if;

  insert into token_balances (business_id, balance)
  values (p_business_id, p_token_count)
  on conflict (business_id) do update
    set balance = token_balances.balance + excluded.balance;

  return true;
end;
$$;

revoke execute on function public.record_token_purchase(text, uuid, uuid, int) from public;
