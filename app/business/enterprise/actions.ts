"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";
import { getOrCreatePlanCode } from "@/lib/enterprise";

const TIERS = new Set(["starter", "growth", "scale", "national"]);
const TRIAL_DAYS = 14;

export async function startTrial(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (account?.role !== "business") {
    redirect("/dashboard");
  }

  const tier = String(formData.get("tier") ?? "");
  if (!TIERS.has(tier)) {
    redirect("/business/enterprise?error=" + encodeURIComponent("Choose a tier."));
  }

  const { data: existing } = await supabase
    .from("enterprise_subscriptions")
    .select("id")
    .eq("business_user_id", user.id)
    .in("status", ["trial", "active", "grace"])
    .maybeSingle();

  if (existing) {
    redirect("/business/enterprise?error=" + encodeURIComponent("You already have an Enterprise subscription."));
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  const trialEndsAtStr = trialEndsAt.toISOString().slice(0, 10);

  const { error } = await supabase.from("enterprise_subscriptions").insert({
    business_user_id: user.id,
    tier,
    status: "trial",
    trial_ends_at: trialEndsAtStr,
    current_period_end: trialEndsAtStr,
  });

  if (error) {
    redirect("/business/enterprise?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/business/enterprise");
  redirect("/business/enterprise?started=1");
}

export async function claimArea(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const province = String(formData.get("province") ?? "").trim();
  const town = String(formData.get("town") ?? "").trim();

  if (!province || !town) {
    redirect("/business/enterprise?error=" + encodeURIComponent("Enter both a province and a town."));
  }

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id, tier, business_user_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription || subscription.business_user_id !== user.id) {
    redirect("/business/enterprise");
  }

  const { data: plan } = await supabase
    .from("enterprise_plans")
    .select("area_limit")
    .eq("tier", subscription.tier)
    .single();

  const { count } = await supabase
    .from("enterprise_subscription_areas")
    .select("location_id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId);

  if (plan?.area_limit != null && (count ?? 0) >= plan.area_limit) {
    redirect(
      "/business/enterprise?error=" + encodeURIComponent(`Your plan allows up to ${plan.area_limit} areas.`),
    );
  }

  const { data: locationId } = await supabase.rpc("get_or_create_location", {
    p_province: province,
    p_town: town,
  });

  if (!locationId) {
    redirect("/business/enterprise?error=" + encodeURIComponent("Could not resolve that location."));
  }

  const { error } = await supabase
    .from("enterprise_subscription_areas")
    .insert({ subscription_id: subscriptionId, location_id: locationId });

  if (error) {
    redirect(
      "/business/enterprise?error=" +
        encodeURIComponent(error.code === "23505" ? "That area is already claimed." : error.message),
    );
  }

  revalidatePath("/business/enterprise");
  redirect("/business/enterprise");
}

export async function removeArea(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const subscriptionId = String(formData.get("subscription_id") ?? "");
  const locationId = String(formData.get("location_id") ?? "");

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id, business_user_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription || subscription.business_user_id !== user.id) {
    redirect("/business/enterprise");
  }

  await supabase
    .from("enterprise_subscription_areas")
    .delete()
    .eq("subscription_id", subscriptionId)
    .eq("location_id", locationId);

  revalidatePath("/business/enterprise");
  redirect("/business/enterprise");
}

export async function initializeEnterpriseCheckout(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const subscriptionId = String(formData.get("subscription_id") ?? "");

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id, tier, business_user_id")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (!subscription || subscription.business_user_id !== user.id) {
    redirect("/business/enterprise");
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let authorizationUrl: string;
  try {
    const planCode = await getOrCreatePlanCode(subscription.tier);
    const { data: plan } = await supabase
      .from("enterprise_plans")
      .select("price_monthly_zar")
      .eq("tier", subscription.tier)
      .single();

    const result = await initializeTransaction({
      email: user.email!,
      amountKobo: Math.round(Number(plan?.price_monthly_zar ?? 0) * 100),
      callbackUrl: `${origin}/business/enterprise/callback`,
      metadata: { type: "enterprise_subscription", subscription_id: subscription.id },
      plan: planCode,
    });
    authorizationUrl = result.authorization_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    redirect("/business/enterprise?error=" + encodeURIComponent(message));
  }

  redirect(authorizationUrl);
}
