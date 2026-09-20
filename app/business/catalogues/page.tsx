import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LinkButton } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <div className="flex items-center justify-between">
        <h1 className="text-ds-display-md">Your catalogues</h1>
        <LinkButton href="/business/catalogues/new" variant="primary">
          New catalogue
        </LinkButton>
      </div>

      {!catalogues || catalogues.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">You haven&apos;t created a catalogue yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {catalogues.map((c) => (
            <li key={c.id}>
              <Link
                href={`/business/catalogues/${c.id}`}
                className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg hover:border-ds-hairline-secondary"
              >
                <div>
                  <p className="font-medium text-ds-ink">{c.name}</p>
                  <p className="text-ds-caption text-ds-mute">
                    {ROLE_LABEL[c.role] ?? c.role} · {c.active ? "Active" : "Inactive"}
                  </p>
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
