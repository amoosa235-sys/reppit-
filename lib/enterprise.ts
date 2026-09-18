import { createServiceClient } from "@/lib/supabase/service";
import { createPlan, verifyTransaction } from "@/lib/paystack";

/**
 * Returns the Paystack plan code for a tier, creating it on first use.
 * We're the source of truth for "has this plan been created" - once
 * enterprise_plans.paystack_plan_code is set, later calls just reuse it,
 * so this never creates a duplicate plan for the same tier.
 */
export async function getOrCreatePlanCode(tier: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: plan } = await supabase
    .from("enterprise_plans")
    .select("tier, price_monthly_zar, paystack_plan_code")
    .eq("tier", tier)
    .single();

  if (!plan) {
    throw new Error(`Unknown Enterprise tier: ${tier}`);
  }

  if (plan.paystack_plan_code) {
    return plan.paystack_plan_code;
  }

  const created = await createPlan({
    name: `Reppit Enterprise - ${tier}`,
    amountKobo: Math.round(Number(plan.price_monthly_zar) * 100),
    interval: "monthly",
  });

  await supabase.from("enterprise_plans").update({ paystack_plan_code: created.plan_code }).eq("tier", tier);

  return created.plan_code;
}

type ActivateResult = { activated: boolean; reason: string };

/**
 * Verifies a Paystack reference and activates/renews the matching
 * Enterprise subscription. Two paths:
 * 1. Initial subscribe charge - our own metadata.subscription_id says
 *    exactly which row to activate.
 * 2. A renewal charge Paystack bills automatically off the Plan -
 *    renewal charges don't reliably carry forward the metadata from the
 *    original transaction, so this falls back to matching by plan_code
 *    + customer email. Best-effort: the exact renewal webhook shape is
 *    documented behavior, not something exercised against a live
 *    Paystack account in this pass.
 */
export async function activateEnterpriseSubscription(reference: string): Promise<ActivateResult> {
  const verification = await verifyTransaction(reference);

  if (verification.status !== "success") {
    return { activated: false, reason: `Payment ${verification.status}` };
  }

  const supabase = createServiceClient();

  const metadata = verification.metadata ?? {};
  let subscriptionId = String(metadata.subscription_id ?? "");

  if (!subscriptionId && verification.plan_object?.plan_code && verification.customer?.email) {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", verification.customer.email)
      .maybeSingle();

    if (user) {
      const { data: plan } = await supabase
        .from("enterprise_plans")
        .select("tier")
        .eq("paystack_plan_code", verification.plan_object.plan_code)
        .maybeSingle();

      if (plan) {
        const { data: subscription } = await supabase
          .from("enterprise_subscriptions")
          .select("id")
          .eq("business_user_id", user.id)
          .eq("tier", plan.tier)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        subscriptionId = subscription?.id ?? "";
      }
    }
  }

  if (!subscriptionId) {
    return { activated: false, reason: "Could not match this payment to a subscription." };
  }

  const { data: wasNew, error } = await supabase.rpc("activate_enterprise_subscription", {
    p_reference: reference,
    p_subscription_id: subscriptionId,
    p_paystack_subscription_code: null,
  });

  if (error) {
    return { activated: false, reason: error.message };
  }

  return { activated: Boolean(wasNew), reason: wasNew ? "ok" : "already processed" };
}

/**
 * Best-effort handling for Paystack's `subscription.disable` webhook -
 * marks the matching business's most recent non-cancelled Enterprise
 * subscription as cancelled. Matches by customer email since that's the
 * one field this event is documented to reliably carry; exact payload
 * shape hasn't been exercised against a live Paystack account.
 */
export async function cancelEnterpriseSubscriptionByEmail(email: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
  if (!user) return;

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id")
    .eq("business_user_id", user.id)
    .in("status", ["trial", "active", "grace"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) return;

  await supabase.from("enterprise_subscriptions").update({ status: "cancelled" }).eq("id", subscription.id);
}
