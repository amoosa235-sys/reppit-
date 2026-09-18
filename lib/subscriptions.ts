import { createServiceClient } from "@/lib/supabase/service";
import { verifyTransaction } from "@/lib/paystack";

// Placeholder annual fees in cents (ZAR) - adjust once pricing is decided.
// 'entry' isn't billable: it's the free default a provider profile starts
// on, not something to subscribe to.
export const ANNUAL_FEE_CENTS: Record<"verified" | "premium", number> = {
  verified: 50000,
  premium: 150000,
};

export function isPayableTier(tier: string): tier is "verified" | "premium" {
  return tier === "verified" || tier === "premium";
}

type ActivateResult = { activated: boolean; reason: string };

/**
 * Verifies a Paystack reference and records the provider's paid annual fee
 * period. Safe to call more than once for the same reference (callback +
 * webhook) - record_provider_subscription is idempotent on the unique
 * paystack_reference constraint.
 */
export async function activateProviderSubscription(reference: string): Promise<ActivateResult> {
  const verification = await verifyTransaction(reference);

  if (verification.status !== "success") {
    return { activated: false, reason: `Payment ${verification.status}` };
  }

  const metadata = verification.metadata ?? {};
  const providerId = String(metadata.provider_id ?? "");
  const tier = String(metadata.tier ?? "");

  if (!providerId || !isPayableTier(tier)) {
    return { activated: false, reason: "Missing subscription metadata." };
  }

  const expectedAmount = ANNUAL_FEE_CENTS[tier];
  if (expectedAmount !== verification.amount) {
    return { activated: false, reason: "Payment amount does not match the selected tier." };
  }

  const supabase = createServiceClient();

  const { data: wasNew, error } = await supabase.rpc("record_provider_subscription", {
    p_reference: reference,
    p_provider_id: providerId,
    p_tier: tier,
    p_amount_cents: expectedAmount,
  });

  if (error) {
    return { activated: false, reason: error.message };
  }

  return { activated: Boolean(wasNew), reason: wasNew ? "ok" : "already processed" };
}
