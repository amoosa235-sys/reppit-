import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOAD_BOOKING_COST } from "@/lib/loads";
import { bookLoad } from "./actions";

type LoadRow = {
  id: string;
  destination_region: string;
  capacity: number | null;
  capacity_booked: number;
  departure_date: string;
  price_per_unit: number | null;
  status: string;
  distribution_hubs: { name: string } | null;
};

export default async function LoadsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; booked?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("consolidated_loads")
    .select(
      "id, destination_region, capacity, capacity_booked, departure_date, price_per_unit, status, distribution_hubs(name)",
    )
    .order("departure_date", { ascending: true });

  const all = (data ?? []) as unknown as LoadRow[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isBusiness = false;
  if (user) {
    const { data: account } = await supabase.from("users").select("role").eq("id", user.id).single();
    isBusiness = account?.role === "business";
  }

  const query = (params.q ?? "").trim().toLowerCase();
  const results = all.filter(
    (l) =>
      !query ||
      l.destination_region.toLowerCase().includes(query) ||
      (l.distribution_hubs?.name ?? "").toLowerCase().includes(query),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Consolidated loads</h1>

      {error && <p className="text-sm text-red-300">Could not load loads: {error.message}</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}
      {params.booked && <p className="text-sm text-teal-300">Load booked.</p>}

      {all.length === 0 && !error ? (
        <p className="text-navy-100">No loads have been listed yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded border border-navy-500 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                className="rounded px-3 py-2 text-navy-900"
                placeholder="Destination or hub"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
            >
              Search
            </button>
            <Link href="/loads" className="text-sm text-teal-300 underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-navy-100">No loads match that search.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((l) => {
                const remaining = l.capacity != null ? l.capacity - l.capacity_booked : null;
                return (
                  <article key={l.id} className="flex flex-col gap-2 rounded border border-navy-500 p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{l.destination_region}</h2>
                      <span className="rounded bg-teal-700 px-2 py-0.5 text-xs capitalize">{l.status}</span>
                    </div>
                    <p className="text-xs text-navy-200">
                      {l.distribution_hubs?.name && `From ${l.distribution_hubs.name} · `}
                      Departs {l.departure_date}
                    </p>
                    <p className="text-xs text-navy-200">
                      {remaining != null ? `${remaining} of ${l.capacity} remaining` : "Capacity not set"}
                      {l.price_per_unit != null && ` · R${l.price_per_unit}/unit`}
                    </p>

                    {isBusiness && l.status === "open" && (
                      <form action={bookLoad} className="flex items-end gap-2">
                        <input type="hidden" name="load_id" value={l.id} />
                        <label className="flex flex-col gap-1 text-xs">
                          <span className="text-navy-100">Quantity</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            name="quantity"
                            required
                            className="w-24 rounded px-2 py-1 text-navy-900"
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Book ({LOAD_BOOKING_COST} tokens)
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
