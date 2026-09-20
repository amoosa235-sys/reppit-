import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveLoad } from "../actions";
import { Button, FormInput } from "@/components/ui";

export default async function NewLoadPage({
  params,
  searchParams,
}: {
  params: Promise<{ hubId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { hubId } = await params;
  const searchParamsResolved = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: hub } = await supabase
    .from("distribution_hubs")
    .select("id, name, provider_profiles(user_id)")
    .eq("id", hubId)
    .maybeSingle();

  const ownerUserId = (hub?.provider_profiles as unknown as { user_id: string } | null)?.user_id;

  if (!hub || ownerUserId !== user.id) {
    redirect("/provider/hubs");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">New load from {hub.name}</h1>

      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <form action={saveLoad} className="flex flex-col gap-4">
        <input type="hidden" name="hub_id" value={hubId} />

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Destination region</span>
          <FormInput type="text" name="destination_region" required />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Capacity</span>
            <FormInput type="number" min={0} step="0.01" name="capacity" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Price per unit (R)</span>
            <FormInput type="number" min={0} step="0.01" name="price_per_unit" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Departure date</span>
          <FormInput type="date" name="departure_date" required />
        </label>

        <input type="hidden" name="status" value="open" />

        <Button type="submit" variant="primary" className="w-fit">
          Create load
        </Button>
      </form>
    </main>
  );
}
