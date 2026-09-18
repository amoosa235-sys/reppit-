import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATALOGUE_UNLOCK_COST } from "@/lib/unlocks";
import { unlockCatalogue } from "./actions";

type Role = "manufacturer" | "distributor" | "both";

type CatalogueRow = {
  id: string;
  name: string;
  role: Role;
  catalogue_items: { product_name: string; category: string | null }[];
};

const ROLE_LABEL: Record<Role, string> = {
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  both: "Manufacturer & distributor",
};

export default async function CataloguesBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("catalogues")
    .select("id, name, role, catalogue_items(product_name, category)")
    .eq("active", true)
    .order("name", { ascending: true });

  const all = (data ?? []) as unknown as CatalogueRow[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let businessId: string | null = null;
  let unlockedCatalogues = new Map<string, string>();

  if (user) {
    const { data: account } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (account?.role === "business") {
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (business) {
        businessId = business.id;
        const { data: unlocks } = await supabase
          .from("unlocks")
          .select("id, catalogue_id")
          .eq("business_id", business.id)
          .not("catalogue_id", "is", null);
        unlockedCatalogues = new Map(
          (unlocks ?? []).map((u) => [u.catalogue_id as string, u.id]),
        );
      }
    }
  }

  const selectedRole =
    params.role === "manufacturer" || params.role === "distributor" || params.role === "both"
      ? params.role
      : "";
  const query = (params.q ?? "").trim().toLowerCase();

  const matchesQuery = (c: CatalogueRow) =>
    !query ||
    c.name.toLowerCase().includes(query) ||
    c.catalogue_items.some(
      (item) =>
        item.product_name.toLowerCase().includes(query) ||
        (item.category ?? "").toLowerCase().includes(query),
    );
  const matchesRole = (c: CatalogueRow, role: string) => !role || c.role === role;

  const results = all.filter((c) => matchesRole(c, selectedRole) && matchesQuery(c));

  const roleCounts = new Map<Role, number>();
  for (const c of all) {
    if (matchesQuery(c)) {
      roleCounts.set(c.role, (roleCounts.get(c.role) ?? 0) + 1);
    }
  }
  const availableRoles = (["manufacturer", "distributor", "both"] as Role[]).filter((r) => roleCounts.has(r));

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Browse catalogues</h1>

      {error && <p className="text-sm text-red-300">Could not load catalogues: {error.message}</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      {all.length === 0 && !error ? (
        <p className="text-navy-100">No catalogues have been published yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded border border-navy-500 p-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Search</span>
              <input
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                className="rounded px-3 py-2 text-navy-900"
                placeholder="Product, category, or catalogue name"
              />
            </label>

            {availableRoles.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-navy-100">Type</span>
                <select name="role" defaultValue={selectedRole} className="rounded px-3 py-2 text-navy-900">
                  <option value="">All</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="submit"
              className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
            >
              Filter
            </button>
            <Link href="/catalogues" className="text-sm text-teal-300 underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-navy-100">No catalogues match those filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((c) => {
                const categories = [...new Set(c.catalogue_items.map((i) => i.category).filter(Boolean))];
                return (
                  <article key={c.id} className="flex flex-col gap-2 rounded border border-navy-500 p-4">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{c.name}</h2>
                      <span className="rounded bg-teal-700 px-2 py-0.5 text-xs">{ROLE_LABEL[c.role]}</span>
                    </div>
                    <p className="text-xs text-navy-200">
                      {c.catalogue_items.length} item{c.catalogue_items.length === 1 ? "" : "s"}
                      {categories.length > 0 && ` · ${categories.join(", ")}`}
                    </p>

                    {businessId &&
                      (unlockedCatalogues.has(c.id) ? (
                        <Link
                          href={`/messages/${unlockedCatalogues.get(c.id)}`}
                          className="mt-1 w-fit rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                        >
                          Message
                        </Link>
                      ) : (
                        <form action={unlockCatalogue}>
                          <input type="hidden" name="catalogue_id" value={c.id} />
                          <button
                            type="submit"
                            className="mt-1 rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                          >
                            Unlock ({CATALOGUE_UNLOCK_COST} tokens)
                          </button>
                        </form>
                      ))}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
