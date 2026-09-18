import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABEL: Record<string, string> = {
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  both: "Manufacturer & distributor",
};

export default async function CataloguesPage() {
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

  const { data: catalogues } = await supabase
    .from("catalogues")
    .select("id, name, role, active, created_at")
    .eq("business_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-300">Your catalogues</h1>
        <Link
          href="/business/catalogues/new"
          className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
        >
          New catalogue
        </Link>
      </div>

      {!catalogues || catalogues.length === 0 ? (
        <p className="text-navy-100">You haven&apos;t created a catalogue yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {catalogues.map((c) => (
            <li key={c.id}>
              <Link
                href={`/business/catalogues/${c.id}`}
                className="flex items-center justify-between rounded border border-navy-500 p-4 hover:bg-navy-800"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-navy-200">
                    {ROLE_LABEL[c.role] ?? c.role} · {c.active ? "Active" : "Inactive"}
                  </p>
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
