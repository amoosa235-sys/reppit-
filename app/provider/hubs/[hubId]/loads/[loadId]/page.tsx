import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveLoad } from "../actions";
import { Button, FormInput } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <Link href={`/provider/hubs/${hubId}`} className="text-ds-body-sm text-ds-link underline">
        Back to {hub.name}
      </Link>

      <h1 className="text-ds-display-md">{load.destination_region}</h1>

      {searchParamsResolved.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <form action={saveLoad} className="flex flex-col gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <input type="hidden" name="hub_id" value={hubId} />
        <input type="hidden" name="load_id" value={loadId} />

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Destination region</span>
          <FormInput
            type="text"
            name="destination_region"
            defaultValue={load.destination_region}
            required
          />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Capacity</span>
            <FormInput
              type="number"
              min={0}
              step="0.01"
              name="capacity"
              defaultValue={load.capacity ?? ""}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Price per unit (R)</span>
            <FormInput
              type="number"
              min={0}
              step="0.01"
              name="price_per_unit"
              defaultValue={load.price_per_unit ?? ""}
            />
          </label>
        </div>

        <p className="text-ds-caption text-ds-mute">Booked so far: {load.capacity_booked}</p>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Departure date</span>
          <FormInput
            type="date"
            name="departure_date"
            defaultValue={load.departure_date}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Status</span>
          <select
            name="status"
            defaultValue={load.status}
            className="font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary"
          >
            <option value="open">Open</option>
            <option value="full">Full</option>
            <option value="departed">Departed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <Button type="submit" variant="primary" className="w-fit">
          Save
        </Button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-ds-display-md">Bookings</h2>
        {!bookings || bookings.length === 0 ? (
          <p className="text-ds-body text-ds-body-md">No bookings yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-ds-body-sm">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-ds-sm border border-ds-hairline p-ds-md">
                Quantity {b.quantity} · {b.tokens_spent} tokens · {new Date(b.booked_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
