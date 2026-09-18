import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveHub } from "../actions";

export default async function NewHubPage({
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

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, category")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile || providerProfile.category !== "logistics") {
    redirect("/provider/profile");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">New hub</h1>

      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <form action={saveHub} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Hub name</span>
          <input type="text" name="name" required className="rounded px-3 py-2 text-navy-900" />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Province</span>
            <input type="text" name="province" className="rounded px-3 py-2 text-navy-900" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-navy-100">Town</span>
            <input type="text" name="town" className="rounded px-3 py-2 text-navy-900" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Routes served</span>
          <input
            type="text"
            name="routes_served"
            className="rounded px-3 py-2 text-navy-900"
            placeholder="Johannesburg-Durban, Johannesburg-Cape Town"
          />
          <span className="text-xs text-navy-200">Comma separated</span>
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Create hub
        </button>
      </form>
    </main>
  );
}
