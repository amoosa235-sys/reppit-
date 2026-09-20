import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATALOGUE_UNLOCK_COST } from "@/lib/unlocks";
import { unlockCatalogue } from "./actions";
import { Button, FormInput, LinkButton } from "@/components/ui";

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

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";

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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Browse catalogues</h1>

      {error && <p className="text-ds-body-sm text-red-400">Could not load catalogues: {error.message}</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      {all.length === 0 && !error ? (
        <p className="text-ds-body text-ds-body-md">No catalogues have been published yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Search</span>
              <FormInput
                type="text"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Product, category, or catalogue name"
              />
            </label>

            {availableRoles.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Type</span>
                <select name="role" defaultValue={selectedRole} className={selectClass}>
                  <option value="">All</option>
                  {availableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <Button type="submit" variant="primary">
              Filter
            </Button>
            <Link href="/catalogues" className="text-ds-body-sm text-ds-link underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-ds-body text-ds-body-md">No catalogues match those filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((c) => {
                const categories = [...new Set(c.catalogue_items.map((i) => i.category).filter(Boolean))];
                return (
                  <article key={c.id} className="flex flex-col gap-2 rounded-ds-sm border border-ds-hairline p-ds-lg">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-ds-ink">{c.name}</h2>
                      <span className="rounded-ds-sm bg-ds-canvas-level-3 px-ds-sm py-0.5 text-ds-caption text-ds-ink">{ROLE_LABEL[c.role]}</span>
                    </div>
                    <p className="text-ds-caption text-ds-mute">
                      {c.catalogue_items.length} item{c.catalogue_items.length === 1 ? "" : "s"}
                      {categories.length > 0 && ` · ${categories.join(", ")}`}
                    </p>

                    {businessId &&
                      (unlockedCatalogues.has(c.id) ? (
                        <LinkButton href={`/messages/${unlockedCatalogues.get(c.id)}`} variant="primary" className="mt-1 w-fit">
                          Message
                        </LinkButton>
                      ) : (
                        <form action={unlockCatalogue}>
                          <input type="hidden" name="catalogue_id" value={c.id} />
                          <Button type="submit" variant="primary" className="mt-1">
                            Unlock ({CATALOGUE_UNLOCK_COST} tokens)
                          </Button>
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
