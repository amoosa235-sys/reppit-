import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-300">Your hubs</h1>
        <Link
          href="/provider/hubs/new"
          className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
        >
          New hub
        </Link>
      </div>

      {!hubs || hubs.length === 0 ? (
        <p className="text-navy-100">You haven&apos;t added a hub yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hubs.map((h) => (
            <li key={h.id}>
              <Link
                href={`/provider/hubs/${h.id}`}
                className="flex items-center justify-between rounded border border-navy-500 p-4 hover:bg-navy-800"
              >
                <div>
                  <p className="font-medium">{h.name}</p>
                  {h.routes_served && h.routes_served.length > 0 && (
                    <p className="text-xs text-navy-200">{h.routes_served.join(", ")}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dashboard" className="text-sm text-teal-300 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
