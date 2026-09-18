"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unlockCostForTier } from "@/lib/unlocks";

export async function unlockProvider(formData: FormData) {
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

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!business) {
    redirect("/business/profile?error=" + encodeURIComponent("Complete your business profile first."));
  }

  const providerId = String(formData.get("provider_id") ?? "");
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id, tier")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) {
    redirect("/browse?error=" + encodeURIComponent("Provider not found."));
  }

  const cost = unlockCostForTier(provider.tier);

  const { error } = await supabase.rpc("spend_tokens_for_unlock", {
    p_business_id: business.id,
    p_provider_id: provider.id,
    p_tokens: cost,
  });

  if (error) {
    const message = error.message.includes("insufficient_tokens")
      ? "Not enough tokens - buy more to unlock this provider."
      : error.message;
    redirect("/browse?error=" + encodeURIComponent(message));
  }

  const { data: unlock } = await supabase
    .from("unlocks")
    .select("id")
    .eq("business_id", business.id)
    .eq("provider_id", provider.id)
    .single();

  redirect(`/messages/${unlock?.id}`);
}
