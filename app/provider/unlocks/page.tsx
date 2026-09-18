import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderUnlocksPage() {
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: unlocks } = providerProfile
    ? await supabase
        .from("unlocks")
        .select("id, unlocked_at, businesses(name, industry)")
        .eq("provider_id", providerProfile.id)
        .order("unlocked_at", { ascending: false })
    : { data: null };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Businesses that unlocked you</h1>

      {!unlocks || unlocks.length === 0 ? (
        <p className="text-navy-100">No businesses have unlocked your profile yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {unlocks.map((u) => {
            const business = u.businesses as unknown as { name: string; industry: string | null } | null;
            return (
              <li key={u.id} className="flex items-center justify-between rounded border border-navy-500 p-3">
                <div>
                  <p className="font-medium">{business?.name}</p>
                  <p className="text-xs text-navy-200">
                    {business?.industry ?? "Business"} · unlocked {new Date(u.unlocked_at).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href={`/messages/${u.id}`}
                  className="rounded bg-teal-500 px-3 py-1 text-sm font-semibold text-white hover:bg-teal-600"
                >
                  Message
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
