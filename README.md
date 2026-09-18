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

## Branding

Logo assets (icon-transparent-512, icon-white-512) and favicon.ico are
not yet in this repo — drop them into `app/` (or `public/`) when
available; `app/layout.tsx` will need an `icons` entry in its
`metadata` export once they're in place.
