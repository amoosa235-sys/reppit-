import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveItem, deleteItem } from "../actions";
import { ItemForm } from "../item-form";

export default async function EditCatalogueItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogueId: string; itemId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { catalogueId, itemId } = await params;
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
    .select("id, name, business_user_id")
    .eq("id", catalogueId)
    .maybeSingle();

  if (!catalogue || catalogue.business_user_id !== user.id) {
    redirect("/business/catalogues");
  }

  const { data: item } = await supabase
    .from("catalogue_items")
    .select("id, product_name, sku, description, price, moq, category, photos")
    .eq("id", itemId)
    .eq("catalogue_id", catalogueId)
    .maybeSingle();

  if (!item) {
    redirect(`/business/catalogues/${catalogueId}`);
  }

  const photos = (item.photos ?? []).map((path: string) => ({
    path,
    url: supabase.storage.from("catalogue-photos").getPublicUrl(path).data.publicUrl,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Edit {item.product_name}</h1>

      {searchParamsResolved.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <ItemForm
        action={saveItem}
        catalogueId={catalogueId}
        itemId={itemId}
        initial={{
          productName: item.product_name,
          sku: item.sku ?? "",
          description: item.description ?? "",
          price: item.price?.toString() ?? "",
          moq: item.moq?.toString() ?? "",
          category: item.category ?? "",
          photos,
        }}
      />

      <form action={deleteItem}>
        <input type="hidden" name="catalogue_id" value={catalogueId} />
        <input type="hidden" name="item_id" value={itemId} />
        <button
          type="submit"
          className="font-ds-sans rounded-ds-sm border border-red-400 px-ds-lg py-ds-md text-ds-body-sm font-semibold text-red-400 hover:bg-ds-canvas-level-2"
        >
          Delete item
        </button>
      </form>
    </main>
  );
}
