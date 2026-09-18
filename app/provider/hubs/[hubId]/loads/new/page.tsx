import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveLoad } from "../actions";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">New load from {hub.name}</h1>

      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={saveLoad} className="flex flex-col gap-4">
        <input type="hidden" name="hub_id" value={hubId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Destination region</span>
          <input type="text" name="destination_region" required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Capacity</span>
            <input type="number" min={0} step="0.01" name="capacity" className="rounded px-3 py-2 text-navy-900" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Price per unit (R)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              name="price_per_unit"
              className="rounded px-3 py-2 text-navy-900"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Departure date</span>
          <input type="date" name="departure_date" required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <input type="hidden" name="status" value="open" />

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Create load
        </button>
      </form>
    </main>
  );
}
