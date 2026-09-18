"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUSES = new Set(["open", "full", "departed", "cancelled"]);

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function saveLoad(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const hubId = String(formData.get("hub_id") ?? "");
  const loadId = String(formData.get("load_id") ?? "") || null;

  const { data: hub } = await supabase
    .from("distribution_hubs")
    .select("id, provider_profiles(user_id)")
    .eq("id", hubId)
    .maybeSingle();

  const ownerUserId = (hub?.provider_profiles as unknown as { user_id: string } | null)?.user_id;

  if (!hub || ownerUserId !== user.id) {
    redirect("/provider/hubs");
  }

  const destinationRegion = String(formData.get("destination_region") ?? "").trim();
  const capacity = toNumberOrNull(formData.get("capacity"));
  const departureDate = String(formData.get("departure_date") ?? "").trim();
  const pricePerUnit = toNumberOrNull(formData.get("price_per_unit"));
  const status = String(formData.get("status") ?? "open");

  const errorPath = loadId
    ? `/provider/hubs/${hubId}/loads/${loadId}`
    : `/provider/hubs/${hubId}/loads/new`;

  if (!destinationRegion) {
    redirect(`${errorPath}?error=` + encodeURIComponent("Destination is required."));
  }
  if (!departureDate) {
    redirect(`${errorPath}?error=` + encodeURIComponent("Departure date is required."));
  }
  if (!STATUSES.has(status)) {
    redirect(`${errorPath}?error=` + encodeURIComponent("Invalid status."));
  }

  if (loadId) {
    const { error } = await supabase
      .from("consolidated_loads")
      .update({
        destination_region: destinationRegion,
        capacity,
        departure_date: departureDate,
        price_per_unit: pricePerUnit,
        status,
      })
      .eq("id", loadId);

    if (error) {
      redirect(`${errorPath}?error=` + encodeURIComponent(error.message));
    }

    revalidatePath(`/provider/hubs/${hubId}/loads/${loadId}`);
    redirect(`/provider/hubs/${hubId}/loads/${loadId}?saved=1`);
  }

  const { data: load, error } = await supabase
    .from("consolidated_loads")
    .insert({
      hub_id: hubId,
      destination_region: destinationRegion,
      capacity,
      departure_date: departureDate,
      price_per_unit: pricePerUnit,
      status,
    })
    .select("id")
    .single();

  if (error || !load) {
    redirect(`${errorPath}?error=` + encodeURIComponent(error?.message ?? "Could not create load."));
  }

  revalidatePath(`/provider/hubs/${hubId}`);
  redirect(`/provider/hubs/${hubId}/loads/${load.id}`);
}
