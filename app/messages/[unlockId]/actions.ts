"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
