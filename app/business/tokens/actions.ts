"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";

export async function initializePurchase(formData: FormData) {
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
    redirect(
      "/business/profile?error=" + encodeURIComponent("Complete your business profile first."),
    );
  }

  const packId = String(formData.get("pack_id") ?? "");
  const { data: pack } = await supabase
    .from("token_packs")
    .select("id, price_cents, active")
    .eq("id", packId)
    .maybeSingle();

  if (!pack || !pack.active) {
    redirect("/business/tokens?error=" + encodeURIComponent("That token pack is no longer available."));
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email: user.email!,
      amountKobo: pack.price_cents,
      callbackUrl: `${origin}/business/tokens/callback`,
      metadata: { business_id: business.id, pack_id: pack.id },
    });
    authorizationUrl = result.authorization_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    redirect("/business/tokens?error=" + encodeURIComponent(message));
  }

  redirect(authorizationUrl);
}
