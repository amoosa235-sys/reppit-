"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

export async function saveProviderProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "provider") {
    redirect("/dashboard");
  }

  const category = String(formData.get("category") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (category !== "rep" && category !== "printer") {
    redirect("/provider/profile?error=" + encodeURIComponent("Choose an account type."));
  }
  if (!name) {
    redirect("/provider/profile?error=" + encodeURIComponent("Business/display name is required."));
  }

  const bio = String(formData.get("bio") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const town = String(formData.get("town") ?? "").trim() || null;

  const { data: providerProfile, error: upsertError } = await supabase
    .from("provider_profiles")
    .upsert(
      { user_id: user.id, category, name, bio, province, town },
      { onConflict: "user_id" },
    )
    .select("id, photos")
    .single();

  if (upsertError || !providerProfile) {
    redirect(
      "/provider/profile?error=" + encodeURIComponent(upsertError?.message ?? "Could not save profile."),
    );
  }

  const providerId = providerProfile.id as string;
  const existingPhotos = (providerProfile.photos as string[] | null) ?? [];

  if (category === "rep") {
    await supabase.from("printer_details").delete().eq("provider_id", providerId);
    await supabase.from("rep_details").upsert(
      {
        provider_id: providerId,
        industries: splitList(formData.get("industries")),
        regions_covered: splitList(formData.get("regions_covered")),
        years_experience: toIntOrNull(formData.get("years_experience")),
        languages: splitList(formData.get("languages")),
      },
      { onConflict: "provider_id" },
    );
  } else {
    await supabase.from("rep_details").delete().eq("provider_id", providerId);
    await supabase.from("printer_details").upsert(
      {
        provider_id: providerId,
        print_types: splitList(formData.get("print_types")),
        turnaround_days: toIntOrNull(formData.get("turnaround_days")),
        equipment: String(formData.get("equipment") ?? "").trim() || null,
        max_print_size: String(formData.get("max_print_size") ?? "").trim() || null,
      },
      { onConflict: "provider_id" },
    );
  }

  const removePaths = new Set(formData.getAll("remove_photos").map(String));
  let photos = existingPhotos.filter((path) => !removePaths.has(path));

  if (removePaths.size > 0) {
    await supabase.storage.from("provider-photos").remove([...removePaths]);
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

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
      .from("provider-photos")
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

  await supabase.from("provider_profiles").update({ photos }).eq("id", providerId);

  revalidatePath("/provider/profile");

  if (errors.length > 0) {
    redirect("/provider/profile?error=" + encodeURIComponent(errors.join("; ")));
  }

  redirect("/provider/profile?saved=1");
}
