"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUSES = new Set(["active", "paused", "ended"]);

export async function sendEngagementMessage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Message can't be empty."));
  }

  const { error } = await supabase.from("messages").insert({
    engagement_id: engagementId,
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}`);
}

export async function updateEngagementStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!STATUSES.has(status)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid status."));
  }

  const update: { status: string; notes: string | null; ended_at?: string } = { status, notes };
  if (status === "ended") {
    update.ended_at = new Date().toISOString();
  }

  const { error } = await supabase.from("engagements").update(update).eq("id", engagementId);

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}
