import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only client that authenticates as the Supabase service role and
 * bypasses RLS entirely. Never import this into a client component or log
 * SUPABASE_SERVICE_ROLE_KEY. Reserved for trusted server code with no end
 * user session to scope RLS to - e.g. the Paystack callback/webhook, which
 * need to write token_balances/token_transactions on the business's behalf.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
