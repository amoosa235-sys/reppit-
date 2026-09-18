import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveHub } from "../actions";

export default async function HubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hubId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
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
    .select("id, name, routes_served, operator_provider_id, provider_profiles(user_id)")
    .eq("id", hubId)
    .maybeSingle();

  const ownerUserId = (hub?.provider_profiles as unknown as { user_id: string } | null)?.user_id;

  if (!hub || ownerUserId !== user.id) {
    redirect("/provider/hubs");
  }

  const { data: loads } = await supabase
    .from("consolidated_loads")
    .select("id, destination_region, capacity, capacity_booked, departure_date, price_per_unit, status")
    .eq("hub_id", hubId)
    .order("departure_date", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href="/provider/hubs" className="text-sm text-teal-300 underline">
        Back to hubs
      </Link>

      <h1 className="text-2xl font-bold text-teal-300">{hub.name}</h1>

      {searchParamsResolved.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={saveHub} className="flex flex-col gap-4 rounded border border-navy-500 p-4">
        <input type="hidden" name="hub_id" value={hubId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Hub name</span>
          <input type="text" name="name" defaultValue={hub.name} required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Province</span>
            <input type="text" name="province" className="rounded px-3 py-2 text-navy-900" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Town</span>
            <input type="text" name="town" className="rounded px-3 py-2 text-navy-900" />
          </label>
        </div>
        <p className="text-xs text-navy-200">Leave blank to keep the current location.</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Routes served</span>
          <input
            type="text"
            name="routes_served"
            defaultValue={(hub.routes_served ?? []).join(", ")}
            className="rounded px-3 py-2 text-navy-900"
          />
          <span className="text-xs text-navy-200">Comma separated</span>
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Save
        </button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-teal-300">Consolidated loads</h2>
        <Link
          href={`/provider/hubs/${hubId}/loads/new`}
          className="rounded bg-teal-500 px-3 py-1 text-sm font-semibold text-white hover:bg-teal-600"
        >
          New load
        </Link>
      </div>

      {!loads || loads.length === 0 ? (
        <p className="text-sm text-navy-100">No loads yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {loads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/provider/hubs/${hubId}/loads/${l.id}`}
                className="flex items-center justify-between rounded border border-navy-500 p-3 text-sm hover:bg-navy-800"
              >
                <span>{l.destination_region}</span>
                <span className="capitalize">{l.status}</span>
                <span>
                  {l.capacity_booked}/{l.capacity ?? "-"}
                </span>
                <span className="text-navy-200">{l.departure_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
