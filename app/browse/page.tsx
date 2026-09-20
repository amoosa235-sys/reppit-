import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { unlockCostForTier } from "@/lib/unlocks";
import { unlockProvider } from "./actions";
import { Button, FormInput, LinkButton } from "@/components/ui";

type Tier = "entry" | "verified" | "premium";
type Category = "rep" | "printer" | "distributor";

type ProviderRow = {
  id: string;
  category: Category;
  name: string;
  bio: string | null;
  province: string | null;
  town: string | null;
  tier: Tier;
  photos: string[] | null;
  rep_details: { industries: string[] | null } | null;
  printer_details: { print_types: string[] | null } | null;
  distributor_details: { product_categories_sought: string[] | null } | null;
};

const TIER_LABEL: Record<Tier, string> = {
  entry: "Entry",
  verified: "Verified",
  premium: "Premium",
};

const CATEGORY_LABEL: Record<Category, string> = {
  rep: "Sales rep",
  printer: "Printer",
  distributor: "Distributor",
};

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; province?: string; tier?: string; town?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("provider_profiles")
    .select(
      "id, category, name, bio, province, town, tier, photos, rep_details(industries), printer_details(print_types), distributor_details(product_categories_sought)",
    )
    .order("tier", { ascending: false })
    .order("name", { ascending: true });

  const all = (data ?? []) as unknown as ProviderRow[];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let businessId: string | null = null;
  let unlockedProviders = new Map<string, string>();

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
          .select("id, provider_id")
          .eq("business_id", business.id);
        unlockedProviders = new Map((unlocks ?? []).map((u) => [u.provider_id, u.id]));
      }
    }
  }

  const selectedCategory =
    params.category === "rep" || params.category === "printer" || params.category === "distributor"
      ? params.category
      : "";
  const selectedProvince = params.province ?? "";
  const selectedTier = params.tier === "entry" || params.tier === "verified" || params.tier === "premium" ? params.tier : "";
  const townQuery = (params.town ?? "").trim().toLowerCase();

  const matchesTown = (p: ProviderRow) => !townQuery || (p.town ?? "").toLowerCase().includes(townQuery);
  const matchesProvince = (p: ProviderRow, province: string) => !province || p.province === province;
  const matchesTier = (p: ProviderRow, tier: string) => !tier || p.tier === tier;
  const matchesCategory = (p: ProviderRow, category: string) => !category || p.category === category;

  const results = all.filter(
    (p) =>
      matchesCategory(p, selectedCategory) &&
      matchesProvince(p, selectedProvince) &&
      matchesTier(p, selectedTier) &&
      matchesTown(p),
  );

  // Facet options only include values that would still return results given
  // the *other* active filters - an empty category/province/tier never
  // shows up as a choice, so users can't pick their way into a blank page.
  const categoryCounts = new Map<Category, number>();
  const provinceCounts = new Map<string, number>();
  const tierCounts = new Map<Tier, number>();

  for (const p of all) {
    if (matchesProvince(p, selectedProvince) && matchesTier(p, selectedTier) && matchesTown(p)) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    }
    if (matchesCategory(p, selectedCategory) && matchesTier(p, selectedTier) && matchesTown(p) && p.province) {
      provinceCounts.set(p.province, (provinceCounts.get(p.province) ?? 0) + 1);
    }
    if (matchesCategory(p, selectedCategory) && matchesProvince(p, selectedProvince) && matchesTown(p)) {
      tierCounts.set(p.tier, (tierCounts.get(p.tier) ?? 0) + 1);
    }
  }

  const availableCategories = (["rep", "printer", "distributor"] as Category[]).filter((c) =>
    categoryCounts.has(c),
  );
  const availableProvinces = [...provinceCounts.keys()].sort();
  const availableTiers = (["premium", "verified", "entry"] as Tier[]).filter((t) => tierCounts.has(t));

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Browse providers</h1>

      {error && <p className="text-ds-body-sm text-red-400">Could not load providers: {error.message}</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      {all.length === 0 && !error ? (
        <p className="text-ds-body text-ds-body-md">No providers have listed yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
            {availableCategories.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Category</span>
                <select name="category" defaultValue={selectedCategory} className={selectClass}>
                  <option value="">All</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {availableProvinces.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Province</span>
                <select name="province" defaultValue={selectedProvince} className={selectClass}>
                  <option value="">All</option>
                  {availableProvinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Town</span>
              <FormInput
                type="text"
                name="town"
                defaultValue={params.town ?? ""}
                placeholder="Search town"
              />
            </label>

            {availableTiers.length > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Tier</span>
                <select name="tier" defaultValue={selectedTier} className={selectClass}>
                  <option value="">All</option>
                  {availableTiers.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <Button type="submit" variant="primary">
              Filter
            </Button>
            <Link href="/browse" className="text-ds-body-sm text-ds-link underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-ds-body text-ds-body-md">No providers match those filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((p) => {
                const photoPath = p.photos?.[0];
                const photoUrl = photoPath
                  ? supabase.storage.from("provider-photos").getPublicUrl(photoPath).data.publicUrl
                  : null;
                const detail =
                  p.category === "rep"
                    ? p.rep_details?.industries?.join(", ")
                    : p.category === "printer"
                      ? p.printer_details?.print_types?.join(", ")
                      : p.distributor_details?.product_categories_sought?.join(", ");

                return (
                  <article key={p.id} className="flex gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-ds-sm bg-ds-canvas-level-3">
                      {photoUrl && <Image src={photoUrl} alt="" fill sizes="80px" className="object-cover" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-medium text-ds-ink">{p.name}</h2>
                        <span className="rounded-ds-sm bg-ds-canvas-level-3 px-ds-sm py-0.5 text-ds-caption text-ds-ink">{TIER_LABEL[p.tier]}</span>
                      </div>
                      <p className="text-ds-caption text-ds-mute">
                        {CATEGORY_LABEL[p.category]}
                        {p.town || p.province ? ` · ${[p.town, p.province].filter(Boolean).join(", ")}` : ""}
                      </p>
                      {detail && <p className="text-ds-caption text-ds-mute">{detail}</p>}
                      {p.bio && <p className="text-ds-body text-ds-body-sm">{p.bio}</p>}

                      {businessId &&
                        (unlockedProviders.has(p.id) ? (
                          <LinkButton href={`/messages/${unlockedProviders.get(p.id)}`} variant="primary" className="mt-1 w-fit">
                            Message
                          </LinkButton>
                        ) : (
                          <form action={unlockProvider}>
                            <input type="hidden" name="provider_id" value={p.id} />
                            <Button type="submit" variant="primary" className="mt-1">
                              Unlock ({unlockCostForTier(p.tier)} tokens)
                            </Button>
                          </form>
                        ))}
                    </div>
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
