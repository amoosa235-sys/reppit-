import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveBusinessProfile } from "./actions";
import { Button, FormInput } from "@/components/ui";

const labelClass = "flex flex-col gap-1";
const textareaClass =
  "font-ds-sans bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-ds-sm outline-none focus:border-ds-hairline-tertiary";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Your business profile</h1>

      {params.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <form action={saveBusinessProfile} className="flex flex-col gap-4">
        <label className={labelClass}>
          <span className="text-ds-caption text-ds-mute">Business name</span>
          <FormInput type="text" name="name" defaultValue={business?.name ?? ""} required />
        </label>

        <label className={labelClass}>
          <span className="text-ds-caption text-ds-mute">Industry</span>
          <FormInput type="text" name="industry" defaultValue={business?.industry ?? ""} />
        </label>

        <label className={labelClass}>
          <span className="text-ds-caption text-ds-mute">Description</span>
          <textarea name="description" defaultValue={business?.description ?? ""} rows={4} className={textareaClass} />
        </label>

        <div className="flex gap-4">
          <label className={labelClass + " flex-1"}>
            <span className="text-ds-caption text-ds-mute">Province</span>
            <FormInput type="text" name="province" defaultValue={business?.province ?? ""} />
          </label>
          <label className={labelClass + " flex-1"}>
            <span className="text-ds-caption text-ds-mute">Town</span>
            <FormInput type="text" name="town" defaultValue={business?.town ?? ""} />
          </label>
        </div>

        <Button type="submit" variant="primary" className="w-fit">
          Save profile
        </Button>
      </form>
    </main>
  );
}
