import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCatalogue } from "../actions";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">New catalogue</h1>

      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <form action={createCatalogue} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Catalogue name</span>
          <input type="text" name="name" required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-navy-100">Catalogue type</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="manufacturer" defaultChecked required />
            Manufacturer (I make these products)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="distributor" />
            Distributor (I source/resell these products)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="both" />
            Both
          </label>
        </fieldset>

        <button
          type="submit"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Create catalogue
        </button>
      </form>
    </main>
  );
}
