import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function EngagementsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  let engagements: { id: string; status: string; started_at: string; provider_profiles: { name: string } | null; businesses_name?: string }[] = [];

  if (account?.role === "business") {
    const { data } = await supabase
      .from("engagements")
      .select("id, status, started_at, provider_profiles(name)")
      .eq("business_user_id", user.id)
      .order("started_at", { ascending: false });
    engagements = (data ?? []) as unknown as typeof engagements;
  } else if (account?.role === "provider") {
    const { data: providerProfile } = await supabase
      .from("provider_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (providerProfile) {
      const { data } = await supabase
        .from("engagements")
        .select("id, status, started_at, business_user_id")
        .eq("provider_profile_id", providerProfile.id)
        .order("started_at", { ascending: false });

      const rows = data ?? [];
      const withNames = await Promise.all(
        rows.map(async (e) => {
          const { data: business } = await supabase
            .from("businesses")
            .select("name")
            .eq("user_id", e.business_user_id)
            .maybeSingle();
          return { ...e, provider_profiles: null, businesses_name: business?.name };
        }),
      );
      engagements = withNames as unknown as typeof engagements;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Engagements</h1>

      {engagements.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">No engagements yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {engagements.map((e) => (
            <li key={e.id}>
              <Link
                href={`/engagements/${e.id}`}
                className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg hover:border-ds-hairline-secondary"
              >
                <span>{e.provider_profiles?.name ?? e.businesses_name ?? "Engagement"}</span>
                <span className="capitalize text-ds-mute">{e.status}</span>
                <span className="text-ds-mute">{new Date(e.started_at).toLocaleDateString()}</span>
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
