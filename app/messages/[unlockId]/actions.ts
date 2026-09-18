"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function sendMessage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const unlockId = String(formData.get("unlock_id") ?? "");
  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent("Message can't be empty."));
  }

  const { error } = await supabase.from("messages").insert({
    unlock_id: unlockId,
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/messages/${unlockId}`);
  redirect(`/messages/${unlockId}`);
}

export async function createOrder(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const unlockId = String(formData.get("unlock_id") ?? "");

  const { data: unlock } = await supabase
    .from("unlocks")
    .select("id, provider_id, catalogue_id, businesses(user_id)")
    .eq("id", unlockId)
    .maybeSingle();

  if (!unlock) {
    redirect("/dashboard");
  }

  const businessUserId = (unlock.businesses as unknown as { user_id: string } | null)?.user_id;

  if (businessUserId !== user.id) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent("Only the unlocking business can create an order here."));
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const quantity = toNumberOrNull(formData.get("quantity"));
  const priceTotal = toNumberOrNull(formData.get("price_total"));

  if (priceTotal == null) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent("Enter a total price."));
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      buyer_user_id: user.id,
      catalogue_id: unlock.catalogue_id,
      provider_profile_id: unlock.provider_id,
      description,
      quantity,
      price_total: priceTotal,
    })
    .select("id")
    .single();

  if (error || !order) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent(error?.message ?? "Could not create order."));
  }

  await supabase.from("order_status_history").insert({
    order_id: order.id,
    stage: "pending",
    note: "Order created",
    changed_by: user.id,
  });

  redirect(`/orders/${order.id}`);
}

export async function submitRating(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const unlockId = String(formData.get("unlock_id") ?? "");
  const rateeId = String(formData.get("ratee_id") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent("Choose a rating from 1 to 5."));
  }

  const { error } = await supabase.from("ratings").insert({
    unlock_id: unlockId,
    rater_id: user.id,
    ratee_id: rateeId,
    rating,
    comment,
  });

  if (error) {
    redirect(`/messages/${unlockId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/messages/${unlockId}`);
  redirect(`/messages/${unlockId}`);
}
