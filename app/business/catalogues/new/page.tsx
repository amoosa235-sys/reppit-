import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCatalogue } from "../actions";
import { Button, FormInput } from "@/components/ui";

export default async function NewCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">New catalogue</h1>

      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <form action={createCatalogue} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Catalogue name</span>
          <FormInput type="text" name="name" required />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-ds-caption text-ds-mute">Catalogue type</legend>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="manufacturer" defaultChecked required />
            Manufacturer (I make these products)
          </label>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="distributor" />
            Distributor (I source/resell these products)
          </label>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="both" />
            Both
          </label>
        </fieldset>

        <Button type="submit" variant="primary" className="w-fit">
          Create catalogue
        </Button>
      </form>
    </main>
  );
}
