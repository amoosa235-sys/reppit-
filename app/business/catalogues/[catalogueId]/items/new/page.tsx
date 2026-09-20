import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveItem } from "../actions";
import { ItemForm } from "../item-form";

export default async function NewCatalogueItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ catalogueId: string }>;
  searchParams: Promise<{ error?: string }>;
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
    .select("id, name, business_user_id")
    .eq("id", catalogueId)
    .maybeSingle();

  if (!catalogue || catalogue.business_user_id !== user.id) {
    redirect("/business/catalogues");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Add item to {catalogue.name}</h1>

      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <ItemForm
        action={saveItem}
        catalogueId={catalogueId}
        initial={{ productName: "", sku: "", description: "", price: "", moq: "", category: "", photos: [] }}
      />
    </main>
  );
}
