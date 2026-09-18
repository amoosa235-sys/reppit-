"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function requireLogisticsProvider(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, category")
    .eq("user_id", userId)
    .maybeSingle();

  if (!providerProfile || providerProfile.category !== "logistics") {
    return null;
  }

  return providerProfile;
}

export async function saveHub(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const providerProfile = await requireLogisticsProvider(supabase, user.id);
  if (!providerProfile) {
    redirect(
      "/provider/profile?error=" +
        encodeURIComponent("Set your provider category to Logistics before managing hubs."),
    );
  }

  const hubId = String(formData.get("hub_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const province = String(formData.get("province") ?? "").trim();
  const town = String(formData.get("town") ?? "").trim();
  const routesServed = splitList(formData.get("routes_served"));

  const errorPath = hubId ? `/provider/hubs/${hubId}` : "/provider/hubs/new";

  if (!name) {
    redirect(`${errorPath}?error=` + encodeURIComponent("Hub name is required."));
  }

  let locationId: string | null = null;
  if (province && town) {
    const { data } = await supabase.rpc("get_or_create_location", { p_province: province, p_town: town });
    locationId = data ?? null;
  }

  if (hubId) {
    const update: { name: string; routes_served: string[]; location_id?: string | null } = {
      name,
      routes_served: routesServed,
    };
    // Only touch location_id when new province/town were actually
    // submitted - otherwise leave the hub's existing location alone
    // rather than nulling it out.
    if (locationId) {
      update.location_id = locationId;
    }

    const { error } = await supabase.from("distribution_hubs").update(update).eq("id", hubId);

    if (error) {
      redirect(`${errorPath}?error=` + encodeURIComponent(error.message));
    }

    revalidatePath(`/provider/hubs/${hubId}`);
    redirect(`/provider/hubs/${hubId}?saved=1`);
  }

  const { data: hub, error } = await supabase
    .from("distribution_hubs")
    .insert({
      name,
      location_id: locationId,
      operator_provider_id: providerProfile.id,
      routes_served: routesServed,
    })
    .select("id")
    .single();

  if (error || !hub) {
    redirect(`${errorPath}?error=` + encodeURIComponent(error?.message ?? "Could not create hub."));
  }

  revalidatePath("/provider/hubs");
  redirect(`/provider/hubs/${hub.id}`);
}
