import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Businesses that unlocked you</h1>

      {!unlocks || unlocks.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">No businesses have unlocked your profile yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {unlocks.map((u) => {
            const business = u.businesses as unknown as { name: string; industry: string | null } | null;
            return (
              <li key={u.id} className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg">
                <div>
                  <p className="font-medium text-ds-ink">{business?.name}</p>
                  <p className="text-ds-caption text-ds-mute">
                    {business?.industry ?? "Business"} · unlocked {new Date(u.unlocked_at).toLocaleDateString()}
                  </p>
                </div>
                <LinkButton href={`/messages/${u.id}`} variant="primary">
                  Message
                </LinkButton>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
