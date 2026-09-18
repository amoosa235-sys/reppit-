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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Add item to {catalogue.name}</h1>

      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <ItemForm
        action={saveItem}
        catalogueId={catalogueId}
        initial={{ productName: "", sku: "", description: "", price: "", moq: "", category: "", photos: [] }}
      />
    </main>
  );
}
