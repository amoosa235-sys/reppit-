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

function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

export async function saveItem(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const catalogueId = String(formData.get("catalogue_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "") || null;

  const { data: catalogue } = await supabase
    .from("catalogues")
    .select("id, business_user_id")
    .eq("id", catalogueId)
    .maybeSingle();

  if (!catalogue || catalogue.business_user_id !== user.id) {
    redirect("/business/catalogues");
  }

  const productName = String(formData.get("product_name") ?? "").trim();
  const errorPath = itemId
    ? `/business/catalogues/${catalogueId}/items/${itemId}`
    : `/business/catalogues/${catalogueId}/items/new`;

  if (!productName) {
    redirect(`${errorPath}?error=` + encodeURIComponent("Product name is required."));
  }

  const sku = String(formData.get("sku") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = toNumberOrNull(formData.get("price"));
  const moq = toIntOrNull(formData.get("moq"));
  const category = String(formData.get("category") ?? "").trim() || null;

  let existingPhotos: string[] = [];

  if (itemId) {
    const { data: existingItem } = await supabase
      .from("catalogue_items")
      .select("photos")
      .eq("id", itemId)
      .single();
    existingPhotos = (existingItem?.photos as string[] | null) ?? [];
  }

  const removePaths = new Set(formData.getAll("remove_photos").map(String));
  const photos = existingPhotos.filter((p) => !removePaths.has(p));

  if (removePaths.size > 0) {
    await supabase.storage.from("catalogue-photos").remove([...removePaths]);
  }

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const errors: string[] = [];
  const slotsLeft = Math.max(0, MAX_PHOTOS - photos.length);

  for (const file of files.slice(0, slotsLeft)) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      errors.push(`${file.name}: file too large (max 5MB)`);
      continue;
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("catalogue-photos")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    photos.push(path);
  }

  if (files.length > slotsLeft) {
    errors.push(`Only ${MAX_PHOTOS} photos allowed - some were not uploaded.`);
  }

  let currentItemId = itemId;

  if (itemId) {
    const { error } = await supabase
      .from("catalogue_items")
      .update({ product_name: productName, sku, description, price, moq, category, photos })
      .eq("id", itemId);
    if (error) errors.push(error.message);
  } else {
    const { data: inserted, error } = await supabase
      .from("catalogue_items")
      .insert({
        catalogue_id: catalogueId,
        product_name: productName,
        sku,
        description,
        price,
        moq,
        category,
        photos,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      redirect(
        `/business/catalogues/${catalogueId}/items/new?error=` +
          encodeURIComponent(error?.message ?? "Could not create item."),
      );
    }
    currentItemId = inserted.id;
  }

  revalidatePath(`/business/catalogues/${catalogueId}`);

  if (errors.length > 0) {
    redirect(
      `/business/catalogues/${catalogueId}/items/${currentItemId}?error=` + encodeURIComponent(errors.join("; ")),
    );
  }

  redirect(`/business/catalogues/${catalogueId}/items/${currentItemId}?saved=1`);
}

export async function deleteItem(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const catalogueId = String(formData.get("catalogue_id") ?? "");
  const itemId = String(formData.get("item_id") ?? "");

  const { data: item } = await supabase
    .from("catalogue_items")
    .select("photos")
    .eq("id", itemId)
    .single();

  const photos = (item?.photos as string[] | null) ?? [];
  if (photos.length > 0) {
    await supabase.storage.from("catalogue-photos").remove(photos);
  }

  await supabase.from("catalogue_items").delete().eq("id", itemId);

  revalidatePath(`/business/catalogues/${catalogueId}`);
  redirect(`/business/catalogues/${catalogueId}`);
}
