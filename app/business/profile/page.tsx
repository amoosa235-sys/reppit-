import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveBusinessProfile } from "./actions";

const inputClass = "rounded px-3 py-2 text-navy-900";
const labelClass = "flex flex-col gap-1";

export default async function BusinessProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
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

  const { data: business } = await supabase
    .from("businesses")
    .select("name, industry, description, province, town")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Your business profile</h1>

      {params.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <form action={saveBusinessProfile} className="flex flex-col gap-4">
        <label className={labelClass}>
          <span className="text-sm text-navy-100">Business name</span>
          <input type="text" name="name" defaultValue={business?.name ?? ""} required className={inputClass} />
        </label>

        <label className={labelClass}>
          <span className="text-sm text-navy-100">Industry</span>
          <input type="text" name="industry" defaultValue={business?.industry ?? ""} className={inputClass} />
        </label>

        <label className={labelClass}>
          <span className="text-sm text-navy-100">Description</span>
          <textarea name="description" defaultValue={business?.description ?? ""} rows={4} className={inputClass} />
        </label>

        <div className="flex gap-4">
          <label className={labelClass + " flex-1"}>
            <span className="text-sm text-navy-100">Province</span>
            <input type="text" name="province" defaultValue={business?.province ?? ""} className={inputClass} />
          </label>
          <label className={labelClass + " flex-1"}>
            <span className="text-sm text-navy-100">Town</span>
            <input type="text" name="town" defaultValue={business?.town ?? ""} className={inputClass} />
          </label>
        </div>

        <button
          type="submit"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Save profile
        </button>
      </form>
    </main>
  );
}
