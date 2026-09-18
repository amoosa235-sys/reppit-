import { createClient } from "@/lib/supabase/server";

type Location = { province: string | null; town: string | null };

/**
 * Returns the token discount percentage (0 if none applies) for a
 * business unlocking something at the given location. Only an 'active'
 * Enterprise subscription counts - trial subscriptions don't get the
 * discount, per the original migration's own design note ("If yes and
 * the subscription is 'active' -> charge discounted").
 *
 * Matches on exact (province, town) against the business's claimed
 * enterprise_subscription_areas. provider_profiles.province/town is the
 * one location field every provider category shares (including
 * distributor, which additionally has distributor_details.covered_towns
 * for finer-grained multi-town coverage) - that finer matching isn't
 * done here, since covered_towns has no associated province in the
 * schema to pair it with for an exact-location match.
 */
export async function getEnterpriseDiscountPct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessUserId: string,
  location: Location,
): Promise<number> {
  if (!location.province || !location.town) {
    return 0;
  }

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id, tier")
    .eq("business_user_id", businessUserId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return 0;
  }

  const { data: areas } = await supabase
    .from("enterprise_subscription_areas")
    .select("locations(province, town)")
    .eq("subscription_id", subscription.id);

  const matches = (areas ?? []).some((a) => {
    const loc = a.locations as unknown as { province: string; town: string } | null;
    return loc?.province === location.province && loc?.town === location.town;
  });

  if (!matches) {
    return 0;
  }

  const { data: plan } = await supabase
    .from("enterprise_plans")
    .select("token_discount_pct")
    .eq("tier", subscription.tier)
    .single();

  return Number(plan?.token_discount_pct ?? 0);
}

/** Never lets a discount reduce the cost below 1 token. */
export function applyDiscount(baseCost: number, discountPct: number): number {
  if (discountPct <= 0) {
    return baseCost;
  }
  return Math.max(1, Math.round(baseCost * (1 - discountPct / 100)));
}
