"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";
import { ANNUAL_FEE_CENTS, isPayableTier } from "@/lib/subscriptions";

export async function initializeSubscription(formData: FormData) {
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile) {
    redirect("/provider/profile?error=" + encodeURIComponent("Create your provider profile first."));
  }

  const tier = String(formData.get("tier") ?? "");
  if (!isPayableTier(tier)) {
    redirect("/provider/subscription?error=" + encodeURIComponent("Choose a tier to subscribe to."));
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email: user.email!,
      amountKobo: ANNUAL_FEE_CENTS[tier],
      callbackUrl: `${origin}/provider/subscription/callback`,
      metadata: { type: "provider_subscription", provider_id: providerProfile.id, tier },
    });
    authorizationUrl = result.authorization_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    redirect("/provider/subscription?error=" + encodeURIComponent(message));
  }

  redirect(authorizationUrl);
}
