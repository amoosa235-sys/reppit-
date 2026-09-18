import { createServiceClient } from "@/lib/supabase/service";
import { verifyTransaction } from "@/lib/paystack";

type CreditResult = { credited: boolean; reason: string };

/**
 * Verifies a Paystack reference and credits the purchasing business's token
 * balance. Safe to call more than once for the same reference (from both
 * the redirect callback and the webhook) - record_token_purchase is
 * idempotent on the unique paystack_reference constraint.
 */
export async function creditTokenPurchase(reference: string): Promise<CreditResult> {
  const verification = await verifyTransaction(reference);

  if (verification.status !== "success") {
    return { credited: false, reason: `Payment ${verification.status}` };
  }

  const metadata = verification.metadata ?? {};
  const businessId = String(metadata.business_id ?? "");
  const packId = String(metadata.pack_id ?? "");

  if (!businessId || !packId) {
    return { credited: false, reason: "Missing purchase metadata." };
  }

  const supabase = createServiceClient();

  const { data: pack } = await supabase
    .from("token_packs")
    .select("id, token_count, price_cents")
    .eq("id", packId)
    .single();

  if (!pack || pack.price_cents !== verification.amount) {
    return { credited: false, reason: "Payment amount does not match the selected pack." };
  }

  const { data: wasNew, error } = await supabase.rpc("record_token_purchase", {
    p_reference: reference,
    p_business_id: businessId,
    p_pack_id: packId,
    p_token_count: pack.token_count,
  });

  if (error) {
    return { credited: false, reason: error.message };
  }

  return { credited: Boolean(wasNew), reason: wasNew ? "ok" : "already processed" };
}
