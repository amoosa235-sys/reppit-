import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveLoad } from "../actions";

export default async function LoadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ hubId: string; loadId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { hubId, loadId } = await params;
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

  const { data: load } = await supabase
    .from("consolidated_loads")
    .select("id, destination_region, capacity, capacity_booked, departure_date, price_per_unit, status")
    .eq("id", loadId)
    .eq("hub_id", hubId)
    .maybeSingle();

  if (!load) {
    redirect(`/provider/hubs/${hubId}`);
  }

  const { data: bookings } = await supabase
    .from("load_bookings")
    .select("id, quantity, tokens_spent, booked_at, booked_by_user_id")
    .eq("load_id", loadId)
    .order("booked_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href={`/provider/hubs/${hubId}`} className="text-sm text-teal-300 underline">
        Back to {hub.name}
      </Link>

      <h1 className="text-2xl font-bold text-teal-300">{load.destination_region}</h1>

      {searchParamsResolved.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={saveLoad} className="flex flex-col gap-4 rounded border border-navy-500 p-4">
        <input type="hidden" name="hub_id" value={hubId} />
        <input type="hidden" name="load_id" value={loadId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Destination region</span>
          <input
            type="text"
            name="destination_region"
            defaultValue={load.destination_region}
            required
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Capacity</span>
            <input
              type="number"
              min={0}
              step="0.01"
              name="capacity"
              defaultValue={load.capacity ?? ""}
              className="rounded px-3 py-2 text-navy-900"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Price per unit (R)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              name="price_per_unit"
              defaultValue={load.price_per_unit ?? ""}
              className="rounded px-3 py-2 text-navy-900"
            />
          </label>
        </div>

        <p className="text-xs text-navy-200">Booked so far: {load.capacity_booked}</p>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Departure date</span>
          <input
            type="date"
            name="departure_date"
            defaultValue={load.departure_date}
            required
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Status</span>
          <select name="status" defaultValue={load.status} className="rounded px-3 py-2 text-navy-900">
            <option value="open">Open</option>
            <option value="full">Full</option>
            <option value="departed">Departed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Save
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-teal-300">Bookings</h2>
        {!bookings || bookings.length === 0 ? (
          <p className="text-sm text-navy-100">No bookings yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {bookings.map((b) => (
              <li key={b.id} className="rounded border border-navy-500 p-2">
                Quantity {b.quantity} · {b.tokens_spent} tokens · {new Date(b.booked_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
