"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateCatalogue(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const catalogueId = String(formData.get("catalogue_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const active = formData.get("active") === "on";

  if (!name) {
    redirect(`/business/catalogues/${catalogueId}?error=` + encodeURIComponent("Catalogue name is required."));
  }
  if (role !== "manufacturer" && role !== "distributor" && role !== "both") {
    redirect(`/business/catalogues/${catalogueId}?error=` + encodeURIComponent("Choose a catalogue type."));
  }

  const { error } = await supabase
    .from("catalogues")
    .update({ name, role, active })
    .eq("id", catalogueId)
    .eq("business_user_id", user.id);

  if (error) {
    redirect(`/business/catalogues/${catalogueId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/business/catalogues/${catalogueId}`);
  redirect(`/business/catalogues/${catalogueId}?saved=1`);
}
