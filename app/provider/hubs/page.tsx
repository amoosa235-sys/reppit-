import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui";

export default async function HubsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, category")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile || providerProfile.category !== "logistics") {
    redirect("/provider/profile");
  }

  const { data: hubs } = await supabase
    .from("distribution_hubs")
    .select("id, name, routes_served")
    .eq("operator_provider_id", providerProfile.id)
    .order("name", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <div className="flex items-center justify-between">
        <h1 className="text-ds-display-md">Your hubs</h1>
        <LinkButton href="/provider/hubs/new" variant="primary">
          New hub
        </LinkButton>
      </div>

      {!hubs || hubs.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">You haven&apos;t added a hub yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hubs.map((h) => (
            <li key={h.id}>
              <Link
                href={`/provider/hubs/${h.id}`}
                className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg hover:border-ds-hairline-secondary"
              >
                <div>
                  <p className="font-medium text-ds-ink">{h.name}</p>
                  {h.routes_served && h.routes_served.length > 0 && (
                    <p className="text-ds-caption text-ds-mute">{h.routes_served.join(", ")}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
