"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATALOGUE_UNLOCK_COST } from "@/lib/unlocks";

export async function unlockCatalogue(formData: FormData) {
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

  const catalogueId = String(formData.get("catalogue_id") ?? "");
  const { data: catalogue } = await supabase
    .from("catalogues")
    .select("id")
    .eq("id", catalogueId)
    .maybeSingle();

  if (!catalogue) {
    redirect("/catalogues?error=" + encodeURIComponent("Catalogue not found."));
  }

  const { error } = await supabase.rpc("spend_tokens_for_catalogue_unlock", {
    p_business_id: business.id,
    p_catalogue_id: catalogue.id,
    p_tokens: CATALOGUE_UNLOCK_COST,
  });

  if (error) {
    const message = error.message.includes("insufficient_tokens")
      ? "Not enough tokens - buy more to unlock this catalogue."
      : error.message;
    redirect("/catalogues?error=" + encodeURIComponent(message));
  }

  const { data: unlock } = await supabase
    .from("unlocks")
    .select("id")
    .eq("business_id", business.id)
    .eq("catalogue_id", catalogue.id)
    .single();

  redirect(`/messages/${unlock?.id}`);
}
