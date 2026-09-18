import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { unlockCostForTier } from "@/lib/unlocks";
import { unlockProvider } from "./actions";

type Tier = "entry" | "verified" | "premium";
type Category = "rep" | "printer";

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
};

const TIER_LABEL: Record<Tier, string> = {
  entry: "Entry",
  verified: "Verified",
  premium: "Premium",
};

const CATEGORY_LABEL: Record<Category, string> = {
  rep: "Sales rep",
  printer: "Printer",
};

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
      "id, category, name, bio, province, town, tier, photos, rep_details(industries), printer_details(print_types)",
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

  const selectedCategory = params.category === "rep" || params.category === "printer" ? params.category : "";
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

  const availableCategories = (["rep", "printer"] as Category[]).filter((c) => categoryCounts.has(c));
  const availableProvinces = [...provinceCounts.keys()].sort();
  const availableTiers = (["premium", "verified", "entry"] as Tier[]).filter((t) => tierCounts.has(t));

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Browse providers</h1>

      {error && <p className="text-sm text-red-300">Could not load providers: {error.message}</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      {all.length === 0 && !error ? (
        <p className="text-navy-100">No providers have listed yet - check back soon.</p>
      ) : (
        <>
          <form method="GET" className="flex flex-wrap items-end gap-4 rounded border border-navy-500 p-4">
            {availableCategories.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-navy-100">Category</span>
                <select name="category" defaultValue={selectedCategory} className="rounded px-3 py-2 text-navy-900">
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
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-navy-100">Province</span>
                <select name="province" defaultValue={selectedProvince} className="rounded px-3 py-2 text-navy-900">
                  <option value="">All</option>
                  {availableProvinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Town</span>
              <input
                type="text"
                name="town"
                defaultValue={params.town ?? ""}
                className="rounded px-3 py-2 text-navy-900"
                placeholder="Search town"
              />
            </label>

            {availableTiers.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-navy-100">Tier</span>
                <select name="tier" defaultValue={selectedTier} className="rounded px-3 py-2 text-navy-900">
                  <option value="">All</option>
                  {availableTiers.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
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
            <Link href="/browse" className="text-sm text-teal-300 underline">
              Clear
            </Link>
          </form>

          {results.length === 0 ? (
            <p className="text-navy-100">No providers match those filters.</p>
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
                    : p.printer_details?.print_types?.join(", ");

                return (
                  <article key={p.id} className="flex gap-4 rounded border border-navy-500 p-4">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded bg-navy-800">
                      {photoUrl && <Image src={photoUrl} alt="" fill sizes="80px" className="object-cover" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{p.name}</h2>
                        <span className="rounded bg-teal-700 px-2 py-0.5 text-xs">{TIER_LABEL[p.tier]}</span>
                      </div>
                      <p className="text-xs text-navy-200">
                        {CATEGORY_LABEL[p.category]}
                        {p.town || p.province ? ` · ${[p.town, p.province].filter(Boolean).join(", ")}` : ""}
                      </p>
                      {detail && <p className="text-xs text-navy-200">{detail}</p>}
                      {p.bio && <p className="text-sm text-navy-100">{p.bio}</p>}

                      {businessId &&
                        (unlockedProviders.has(p.id) ? (
                          <Link
                            href={`/messages/${unlockedProviders.get(p.id)}`}
                            className="mt-1 w-fit rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                          >
                            Message
                          </Link>
                        ) : (
                          <form action={unlockProvider}>
                            <input type="hidden" name="provider_id" value={p.id} />
                            <button
                              type="submit"
                              className="mt-1 rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                            >
                              Unlock ({unlockCostForTier(p.tier)} tokens)
                            </button>
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
