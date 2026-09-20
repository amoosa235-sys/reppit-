import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCatalogue } from "./actions";
import { Button, FormInput, LinkButton } from "@/components/ui";

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

  const { data: unlocks } = await supabase
    .from("unlocks")
    .select("id, unlocked_at, businesses(name)")
    .eq("catalogue_id", catalogueId)
    .order("unlocked_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <Link href="/business/catalogues" className="text-ds-body-sm text-ds-link underline">
        Back to catalogues
      </Link>

      <h1 className="text-ds-display-md">{catalogue.name}</h1>

      {searchParamsResolved.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <form action={updateCatalogue} className="flex flex-col gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <input type="hidden" name="catalogue_id" value={catalogueId} />

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Catalogue name</span>
          <FormInput type="text" name="name" defaultValue={catalogue.name} required />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-ds-caption text-ds-mute">Catalogue type</legend>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="manufacturer" defaultChecked={catalogue.role === "manufacturer"} />
            Manufacturer
          </label>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="distributor" defaultChecked={catalogue.role === "distributor"} />
            Distributor
          </label>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="both" defaultChecked={catalogue.role === "both"} />
            Both
          </label>
        </fieldset>

        <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
          <input type="checkbox" name="active" defaultChecked={catalogue.active} />
          Active (visible to distributors/stockists browsing)
        </label>

        <Button type="submit" variant="primary" className="w-fit">
          Save
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="text-ds-display-md">Items</h2>
        <LinkButton href={`/business/catalogues/${catalogueId}/items/new`} variant="primary">
          Add item
        </LinkButton>
      </div>

      {!items || items.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">No items yet.</p>
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
                  className="flex items-center gap-3 rounded-ds-sm border border-ds-hairline p-ds-md hover:border-ds-hairline-secondary"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-ds-sm bg-ds-canvas-level-3">
                    {photoUrl && <Image src={photoUrl} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <div>
                    <p className="font-medium text-ds-ink">{item.product_name}</p>
                    <p className="text-ds-caption text-ds-mute">
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

      <h2 className="text-ds-display-md">Businesses that unlocked this catalogue</h2>

      {!unlocks || unlocks.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">No businesses have unlocked this catalogue yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {unlocks.map((u) => {
            const business = u.businesses as unknown as { name: string } | null;
            return (
              <li key={u.id} className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-md">
                <div>
                  <p className="font-medium text-ds-ink">{business?.name}</p>
                  <p className="text-ds-caption text-ds-mute">
                    unlocked {new Date(u.unlocked_at).toLocaleDateString()}
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
