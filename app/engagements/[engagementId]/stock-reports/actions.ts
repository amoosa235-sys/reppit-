"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createStockReport(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const storeLocation = String(formData.get("store_location") ?? "").trim() || null;
  const productName = String(formData.get("product_name") ?? "").trim() || null;
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const quantityOnShelf = toNumberOrNull(formData.get("quantity_on_shelf"));

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
    const path = `${engagementId}/stock-reports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("team-management")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    photos.push(path);
  }

  const { error } = await supabase.from("stock_reports").insert({
    engagement_id: engagementId,
    store_location: storeLocation,
    product_name: productName,
    sku,
    quantity_on_shelf: quantityOnShelf,
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
