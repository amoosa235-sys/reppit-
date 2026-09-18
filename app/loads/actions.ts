"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOAD_BOOKING_COST } from "@/lib/loads";

export async function bookLoad(formData: FormData) {
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

  const loadId = String(formData.get("load_id") ?? "");
  const quantity = Number(formData.get("quantity"));

  if (!Number.isFinite(quantity) || quantity <= 0) {
    redirect("/loads?error=" + encodeURIComponent("Enter a valid quantity."));
  }

  const { error } = await supabase.rpc("book_load", {
    p_business_id: business.id,
    p_user_id: user.id,
    p_load_id: loadId,
    p_quantity: quantity,
    p_tokens: LOAD_BOOKING_COST,
  });

  if (error) {
    const message = error.message.includes("insufficient_tokens")
      ? "Not enough tokens - buy more to book this load."
      : error.message.includes("load_not_open")
        ? "This load is no longer open for booking."
        : error.message.includes("insufficient_capacity")
          ? "Not enough remaining capacity for that quantity."
          : error.message;
    redirect("/loads?error=" + encodeURIComponent(message));
  }

  redirect("/loads?booked=1");
}
