"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ALLOWED_ASSET_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const CAMPAIGN_STATUSES = new Set(["planned", "active", "completed", "cancelled"]);
const ASSET_TYPES = new Set(["design", "promo_material"]);

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dateOrNull(value: FormDataEntryValue | null): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

export async function createCampaign(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Campaign name is required."));
  }

  const { error } = await supabase.from("marketing_campaigns").insert({
    engagement_id: engagementId,
    name,
    budget: toNumberOrNull(formData.get("budget")),
    start_date: dateOrNull(formData.get("start_date")),
    end_date: dateOrNull(formData.get("end_date")),
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function updateCampaign(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!CAMPAIGN_STATUSES.has(status)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid status."));
  }

  const { error } = await supabase
    .from("marketing_campaigns")
    .update({
      status,
      cost_actual: toNumberOrNull(formData.get("cost_actual")) ?? 0,
    })
    .eq("id", campaignId);

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function uploadMarketingAsset(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const campaignId = String(formData.get("campaign_id") ?? "");
  const assetType = String(formData.get("asset_type") ?? "");

  if (!ASSET_TYPES.has(assetType)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid asset type."));
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Choose a file to upload."));
  }

  if (!ALLOWED_ASSET_TYPES.has(file.type)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Unsupported file type."));
  }

  if (file.size > MAX_ASSET_BYTES) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("File too large (max 10MB)."));
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${engagementId}/marketing/${campaignId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("team-management")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(uploadError.message));
  }

  const { error } = await supabase.from("marketing_assets").insert({
    campaign_id: campaignId,
    asset_type: assetType,
    file_url: path,
    uploaded_by: user.id,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}
