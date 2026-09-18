# Reppit

South African marketplace connecting businesses with sales reps and
poster/signage printers.

Stack: Next.js (App Router) + Tailwind CSS + Supabase (Postgres, Auth,
Storage). Deploy target: Vercel.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project, then run `reppit_schema.sql` against it
   (SQL editor, or `supabase db execute -f reppit_schema.sql`). Don't
   regenerate this file from an ORM — edit it by hand and re-run
   migrations manually.

3. Copy `.env.example` to `.env.local` and fill in your Supabase and
   Paystack keys:

   ```bash
   cp .env.example .env.local
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

   Until `.env.local` has real Supabase credentials, requests will
   500 out of the auth middleware (`proxy.ts`) — that's expected.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript, no emit

## Project structure

- `app/` — Next.js App Router routes
- `lib/supabase/` — Supabase client (browser), server client, and the
  session-refresh helper used by `proxy.ts` (Next's middleware
  convention)
- `reppit_schema.sql` — Postgres schema (tables + RLS policies) for v1

## v1 scope

Auth, provider profiles (rep/printer), location (text + province/town),
browse/search, manual verification, token purchases (Paystack), unlock
+ messaging, ratings, provider annual fee. Catalogues, orders,
logistics, and the distributor category are designed for later phases
and intentionally not built yet.

## v2 migrations

`migrations/` holds the phase 2+ migrations, run against Supabase in
order, **after** `reppit_schema.sql`:

1. `reppit_migration_001b_catchup_catalogues_logistics.sql` —
   `catalogues`, `catalogue_items`, `distributor_details`,
   `distribution_hubs`, `consolidated_loads`, `load_bookings`. These
   were designed in the original v1 schema notes but never actually
   created (v1's trimmed scope only built what reps/printers needed).
   All `IF NOT EXISTS`, safe to run regardless of current state. Adds
   a nullable `unlocks.catalogue_id`, but leaves `unlocks.provider_id`
   `NOT NULL` from v1 untouched — catalogue-only unlocks need a schema
   fix (drop that `NOT NULL`, add an exclusivity check, split the
   unique constraint) before they'll actually work; that lands with
   the catalogue-unlock feature, not this migration.
2. `reppit_migration_001c_distributor_rls.sql` — not part of the
   provided set; fills two gaps `001b` left open so the distributor
   category actually works: widens `provider_profiles.category`'s
   check constraint (still v1's `rep`/`printer` only) to add
   `distributor`, and enables RLS + policies on `distributor_details`
   (created by `001b` with RLS off entirely - open to any
   authenticated/anon caller until this runs).
3. `reppit_migration_001d_catalogues_rls.sql` — not part of the
   provided set; same fix as `001c` but for `catalogues` and
   `catalogue_items` (also created by `001b` with RLS off entirely).
   Also adds the public `catalogue-photos` storage bucket, since
   catalogues are browsable pre-unlock the same way provider profiles
   are.
5. `reppit_migration_001e_catalogue_unlocks.sql` — not part of the
   provided set; closes the `unlocks.provider_id NOT NULL` gap flagged
   when `001b` was filed. Drops that `NOT NULL`, adds an exclusivity
   check (exactly one of `provider_id`/`catalogue_id`), and a partial
   unique index for catalogue unlocks (`uq_unlocks_provider` only ever
   covered the provider case). Also extends `unlocks_select`,
   `users_select_via_unlock` (as a second, separate policy — the
   catalogue owner isn't reached through a `provider_profiles` join
   the way a provider is), and `messages_insert` to recognize a
   catalogue unlock's counterpart, none of which existing policies
   accounted for. Adds `spend_tokens_for_catalogue_unlock`, the same
   locking/idempotency pattern as `spend_tokens_for_unlock`.
6. `reppit_migration_001f_logistics.sql` — not part of the provided
   set; same RLS-off gap as `001c`/`001d`, now for `distribution_hubs`,
   `consolidated_loads`, and `load_bookings`, plus widens
   `provider_profiles.category` to add `logistics`. There's no
   separate "logistics_details" table anywhere in the provided
   migrations the way rep/printer/distributor each have one -
   `distribution_hubs` (hub location + `routes_served`, already keyed
   by `operator_provider_id`) stands in as that profile; a provider can
   operate more than one hub. Adds `book_load()`, which - unlike the
   unlock-spend functions - has no identity-based idempotency gate,
   since `load_bookings` carries no uniqueness constraint and a second
   booking on the same load by the same business is legitimate (more
   space, not a duplicate); it locks and checks both the token balance
   and the load's remaining capacity before booking. Also adds
   `get_or_create_location()`, since `distribution_hubs.location_id` is
   a hard FK to `locations(id)` (unlike `provider_profiles`/`businesses`,
   which use free-text province/town per v1's "defer the full locality
   dataset" decision) - the hub form stays plain province/town text
   inputs, resolving or creating the matching `locations` row behind
   the scenes.
7. `reppit_migration_002_orders_progress.sql` — order lifecycle,
   payments, delivery, order-linked messaging. Depends on `001b`
   (`catalogues`).
7. `reppit_migration_002a_orders_rls.sql` — not part of the provided
   set; `002` defined `orders`/`order_status_history` with no RLS at
   all (same as `001b`'s tables before their fixes), added
   `messages.order_id` but never extended `messages_insert` to
   recognize it, and left no column to make a Paystack order payment
   idempotent. Enables RLS on both new tables, adds a
   `users_select_via_order` contact-reveal policy, adds the `order_id`
   branch to `messages_insert`, adds `orders.paystack_reference` (+
   unique constraint) and `record_order_payment`, and adds the private
   `order-proofs` bucket for EFT proof-of-payment uploads — keyed by
   `<order_id>/<file>`, not `<user_id>/<file>` like the other buckets,
   since read access here is by order membership (buyer, seller, or
   admin), not simply by who uploaded it.
8. `reppit_migration_003_enterprise.sql` — Enterprise area
   subscriptions and discounted token pricing. No dependency on `001b`
   or `002`; can run any time after `reppit_schema.sql`.
9. `reppit_migration_004_team_management.sql` — engagements + the
   sales rep / merchandiser / marketing team dashboard. Depends on
   `002` (orders) and `003` (enterprise_subscriptions).
10. `reppit_migration_003a_enterprise_rls.sql` — not part of the
    provided set; same RLS-off gap as everywhere else, now for
    `enterprise_plans`/`enterprise_subscriptions`/
    `enterprise_subscription_areas`. Adds `paystack_plan_code` (on
    `enterprise_plans`) and `paystack_subscription_code` (on
    `enterprise_subscriptions`), plus a new
    `enterprise_subscription_payments` log table and
    `activate_enterprise_subscription()`. Unlike the other payment
    functions, this one has to stay idempotent across a *recurring*
    charge (a new Paystack reference every month, each one legitimately
    extending the paid period once) rather than a single one-time
    payment - a plain `paystack_reference` column can't express "seen
    this one before" for that, hence the log table. Run after `003` and
    `004` (needs `004`'s `trial_ends_at` for the trial flow to make
    sense, even though its own SQL only requires `003`).
11. `reppit_migration_004a_team_rls.sql` — not part of the provided
    set; same RLS-off gap as everywhere else, now for `engagements`,
    `store_returns`, `refunds`, `damages`, `stock_reports`,
    `marketing_campaigns`, `marketing_assets`. `004`'s own note said
    "gated in application logic" for Enterprise access but never
    defined a gate to call - adds `has_enterprise_access()` and
    `engagement_has_enterprise_access()` (both security definer, since
    the actor inserting a child row - e.g. a provider filing a stock
    report - has no RLS visibility into the business's own
    subscription row). Also adds the `engagement_id` branch to
    `messages_insert` (same gap `002a` found for `order_id`), and the
    private `team-management` storage bucket for damage photos, stock
    report photos, and marketing assets. Run after `004`.
12. `reppit_migration_005_payment_terms.sql` — engagement payment
    terms (commission/retainer, Paystack Transfer Recipient reference
    only, no money movement). Depends on `004` (engagements) and `002`
    (orders).

These are provided files, not authored from this codebase's
conventions — e.g. `enterprise_subscriptions.business_user_id`
references `users(id)` directly rather than `businesses(id)` the way
v1's `token_balances`/`unlocks` do. Run as given rather than
reconciled to v1's pattern.

## Token purchases (Paystack)

`/business/tokens` reads active rows from `token_packs`, but there's no
admin UI for managing that table yet — seed it by hand in Supabase, e.g.:

```sql
insert into token_packs (name, token_count, price_cents, active) values
  ('Starter', 10, 15000, true),
  ('Growth', 50, 60000, true);
```

`price_cents` is the amount in the smallest currency unit (matches
what Paystack's API expects). Payments are verified twice - once when
Paystack redirects the browser back to `/business/tokens/callback`,
and again defensively via `/api/webhooks/paystack` (configure this URL
in the Paystack dashboard once keys are live) - both paths are
idempotent per payment reference, so a payment is never credited
twice.

## Provider annual fee (Paystack)

`/provider/subscription` charges a fixed annual fee for the `verified`
and `premium` tiers, hardcoded in `lib/subscriptions.ts`
(`ANNUAL_FEE_CENTS`) since there's no pricing table for it — edit that
file to change pricing. `entry` isn't billable; it's the free default
every provider profile starts on.

Paying the fee records an "active" row in `provider_subscriptions`
with a one-year expiry - it does **not** change
`provider_profiles.tier`. Tier stays owned by manual verification
(admin sets it after reviewing documents); this only tracks whether
the annual fee for a given tier has been paid. If you want a paid
subscription to actually elevate the profile tier, that's a
deliberate design decision to revisit, not an oversight.

Same verify-twice pattern as token purchases: the callback route and
`/api/webhooks/paystack` both call `record_provider_subscription`,
which is idempotent per payment reference. The shared webhook
distinguishes a token purchase from a subscription payment via a
`type` field in the Paystack transaction metadata.

## Branding

Logo assets (icon-transparent-512, icon-white-512) and favicon.ico are
not yet in this repo — drop them into `app/` (or `public/`) when
available; `app/layout.tsx` will need an `icons` entry in its
`metadata` export once they're in place.
