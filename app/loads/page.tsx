import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LOAD_BOOKING_COST } from "@/lib/loads";
import { bookLoad } from "./actions";
import { Button, FormInput } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Consolidated loads</h1>

      {error && <p className="text-ds-body-sm text-red-400">Could not load loads: {error.message}</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}
      {params.booked && <p className="text-ds-body-sm text-ds-success">Load booked.</p>}

      {all.length === 0 && !error ? (
        <p className="text-ds-body text-ds-body-md">No loads have been listed yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Search</span>
              <FormInput
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Destination or hub"
              />
            </label>
            <Button type="submit" variant="primary">
              Search
            </Button>
            <Link href="/loads" className="text-ds-body-sm text-ds-link underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-ds-body text-ds-body-md">No loads match that search.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((l) => {
                const remaining = l.capacity != null ? l.capacity - l.capacity_booked : null;
                return (
                  <article key={l.id} className="flex flex-col gap-2 rounded-ds-sm border border-ds-hairline p-ds-lg">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-ds-ink">{l.destination_region}</h2>
                      <span className="rounded-ds-sm bg-ds-canvas-level-3 px-ds-sm py-0.5 text-ds-caption capitalize text-ds-ink">{l.status}</span>
                    </div>
                    <p className="text-ds-caption text-ds-mute">
                      {l.distribution_hubs?.name && `From ${l.distribution_hubs.name} · `}
                      Departs {l.departure_date}
                    </p>
                    <p className="text-ds-caption text-ds-mute">
                      {remaining != null ? `${remaining} of ${l.capacity} remaining` : "Capacity not set"}
                      {l.price_per_unit != null && ` · R${l.price_per_unit}/unit`}
                    </p>

                    {isBusiness && l.status === "open" && (
                      <form action={bookLoad} className="flex items-end gap-2">
                        <input type="hidden" name="load_id" value={l.id} />
                        <label className="flex flex-col gap-1">
                          <span className="text-ds-caption text-ds-mute">Quantity</span>
                          <FormInput
                            type="number"
                            min={0}
                            step="0.01"
                            name="quantity"
                            required
                            className="w-24"
                          />
                        </label>
                        <Button type="submit" variant="primary">
                          Book ({LOAD_BOOKING_COST} tokens)
                        </Button>
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
