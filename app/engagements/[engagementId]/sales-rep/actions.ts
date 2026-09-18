"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const RETURN_STATUSES = new Set(["reported", "processing", "resolved"]);
const REFUND_STATUSES = new Set(["pending", "approved", "rejected", "paid"]);

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function orderIdOrNull(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

export async function createReturn(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");

  const { error } = await supabase.from("store_returns").insert({
    engagement_id: engagementId,
    order_id: orderIdOrNull(formData.get("order_id")),
    store_location: String(formData.get("store_location") ?? "").trim() || null,
    product_name: String(formData.get("product_name") ?? "").trim() || null,
    quantity: toNumberOrNull(formData.get("quantity")),
    reason: String(formData.get("reason") ?? "").trim() || null,
    reported_by: user.id,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function updateReturnStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const returnId = String(formData.get("return_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!RETURN_STATUSES.has(status)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid status."));
  }

  const { error } = await supabase.from("store_returns").update({ status }).eq("id", returnId);

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function createRefund(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const amount = toNumberOrNull(formData.get("amount"));

  if (amount == null) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Enter a refund amount."));
  }

  const { error } = await supabase.from("refunds").insert({
    engagement_id: engagementId,
    order_id: orderIdOrNull(formData.get("order_id")),
    amount,
    reason: String(formData.get("reason") ?? "").trim() || null,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function updateRefundStatus(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const refundId = String(formData.get("refund_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!REFUND_STATUSES.has(status)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid status."));
  }

  const { error } = await supabase
    .from("refunds")
    .update({ status, processed_by: user.id, processed_at: new Date().toISOString() })
    .eq("id", refundId);

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function createDamage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const errors: string[] = [];
  const photos: string[] = [];

  for (const file of files.slice(0, MAX_PHOTOS)) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      errors.push(`${file.name}: file too large (max 5MB)`);
      continue;
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${engagementId}/damages/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("team-management")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    photos.push(path);
  }

  const { error } = await supabase.from("damages").insert({
    engagement_id: engagementId,
    order_id: orderIdOrNull(formData.get("order_id")),
    description,
    photos,
    reported_by: user.id,
  });

  if (error) {
    errors.push(error.message);
  }

  revalidatePath(`/engagements/${engagementId}`);

  if (errors.length > 0) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(errors.join("; ")));
  }

  redirect(`/engagements/${engagementId}?saved=1`);
}
