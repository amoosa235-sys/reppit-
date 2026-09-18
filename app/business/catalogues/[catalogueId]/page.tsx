import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCatalogue } from "./actions";

export default async function CatalogueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogueId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { catalogueId } = await params;
  const searchParamsResolved = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: catalogue } = await supabase
    .from("catalogues")
    .select("id, name, role, active, business_user_id")
    .eq("id", catalogueId)
    .maybeSingle();

  if (!catalogue || catalogue.business_user_id !== user.id) {
    redirect("/business/catalogues");
  }

  const { data: items } = await supabase
    .from("catalogue_items")
    .select("id, product_name, sku, price, moq, category, photos")
    .eq("catalogue_id", catalogueId)
    .order("product_name", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href="/business/catalogues" className="text-sm text-teal-300 underline">
        Back to catalogues
      </Link>

      <h1 className="text-2xl font-bold text-teal-300">{catalogue.name}</h1>

      {searchParamsResolved.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={updateCatalogue} className="flex flex-col gap-4 rounded border border-navy-500 p-4">
        <input type="hidden" name="catalogue_id" value={catalogueId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Catalogue name</span>
          <input type="text" name="name" defaultValue={catalogue.name} required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-navy-100">Catalogue type</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="manufacturer" defaultChecked={catalogue.role === "manufacturer"} />
            Manufacturer
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="distributor" defaultChecked={catalogue.role === "distributor"} />
            Distributor
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="both" defaultChecked={catalogue.role === "both"} />
            Both
          </label>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-navy-100">
          <input type="checkbox" name="active" defaultChecked={catalogue.active} />
          Active (visible to distributors/stockists browsing)
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Save
        </button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-teal-300">Items</h2>
        <Link
          href={`/business/catalogues/${catalogueId}/items/new`}
          className="rounded bg-teal-500 px-3 py-1 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Add item
        </Link>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-sm text-navy-100">No items yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const photoPath = item.photos?.[0];
            const photoUrl = photoPath
              ? supabase.storage.from("catalogue-photos").getPublicUrl(photoPath).data.publicUrl
              : null;
            return (
              <li key={item.id}>
                <Link
                  href={`/business/catalogues/${catalogueId}/items/${item.id}`}
                  className="flex items-center gap-3 rounded border border-navy-500 p-3 hover:bg-navy-800"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-navy-800">
                    {photoUrl && <Image src={photoUrl} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-navy-200">
                      {item.sku && `SKU ${item.sku} · `}
                      {item.price != null && `R${item.price} · `}
                      {item.moq != null && `MOQ ${item.moq}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
