import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessUnlocksPage() {
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

  if (account?.role !== "business") {
    redirect("/dashboard");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: providerUnlocks } = business
    ? await supabase
        .from("unlocks")
        .select("id, unlocked_at, provider_profiles(name, category, tier)")
        .eq("business_id", business.id)
        .not("provider_id", "is", null)
        .order("unlocked_at", { ascending: false })
    : { data: null };

  const { data: catalogueUnlocks } = business
    ? await supabase
        .from("unlocks")
        .select("id, unlocked_at, catalogues(name, role)")
        .eq("business_id", business.id)
        .not("catalogue_id", "is", null)
        .order("unlocked_at", { ascending: false })
    : { data: null };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Your unlocks</h1>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-teal-300">Providers</h2>
        {!providerUnlocks || providerUnlocks.length === 0 ? (
          <p className="text-sm text-navy-100">
            You haven&apos;t unlocked any providers yet. <Link href="/browse" className="text-teal-300 underline">Browse providers</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {providerUnlocks.map((u) => {
              const provider = u.provider_profiles as unknown as {
                name: string;
                category: string;
                tier: string;
              } | null;
              return (
                <li key={u.id} className="flex items-center justify-between rounded border border-navy-500 p-3">
                  <div>
                    <p className="font-medium">{provider?.name}</p>
                    <p className="text-xs text-navy-200">
                      {provider?.category} · {provider?.tier} · unlocked {new Date(u.unlocked_at).toLocaleDateString()}
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
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-teal-300">Catalogues</h2>
        {!catalogueUnlocks || catalogueUnlocks.length === 0 ? (
          <p className="text-sm text-navy-100">
            You haven&apos;t unlocked any catalogues yet. <Link href="/catalogues" className="text-teal-300 underline">Browse catalogues</Link>.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {catalogueUnlocks.map((u) => {
              const catalogue = u.catalogues as unknown as { name: string; role: string } | null;
              return (
                <li key={u.id} className="flex items-center justify-between rounded border border-navy-500 p-3">
                  <div>
                    <p className="font-medium">{catalogue?.name}</p>
                    <p className="text-xs text-navy-200">
                      {catalogue?.role} · unlocked {new Date(u.unlocked_at).toLocaleDateString()}
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
      </section>
    </main>
  );
}
