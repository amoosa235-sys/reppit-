import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveHub } from "../actions";
import { Button, FormInput, LinkButton } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <Link href="/provider/hubs" className="text-ds-body-sm text-ds-link underline">
        Back to hubs
      </Link>

      <h1 className="text-ds-display-md">{hub.name}</h1>

      {searchParamsResolved.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <form action={saveHub} className="flex flex-col gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <input type="hidden" name="hub_id" value={hubId} />

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Hub name</span>
          <FormInput type="text" name="name" defaultValue={hub.name} required />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Province</span>
            <FormInput type="text" name="province" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Town</span>
            <FormInput type="text" name="town" />
          </label>
        </div>
        <p className="text-ds-caption text-ds-mute">Leave blank to keep the current location.</p>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Routes served</span>
          <FormInput
            type="text"
            name="routes_served"
            defaultValue={(hub.routes_served ?? []).join(", ")}
          />
          <span className="text-ds-caption text-ds-mute">Comma separated</span>
        </label>

        <Button type="submit" variant="primary" className="w-fit">
          Save
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-ds-display-md">Consolidated loads</h2>
        <LinkButton href={`/provider/hubs/${hubId}/loads/new`} variant="primary">
          New load
        </LinkButton>
      </div>

      {!loads || loads.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">No loads yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {loads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/provider/hubs/${hubId}/loads/${l.id}`}
                className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg hover:border-ds-hairline-secondary"
              >
                <span>{l.destination_region}</span>
                <span className="capitalize">{l.status}</span>
                <span>
                  {l.capacity_booked}/{l.capacity ?? "-"}
                </span>
                <span className="text-ds-mute">{l.departure_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
