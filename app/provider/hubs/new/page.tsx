import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveHub } from "../actions";
import { Button, FormInput } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">New hub</h1>

      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <form action={saveHub} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Hub name</span>
          <FormInput type="text" name="name" required />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Province</span>
            <FormInput type="text" name="province" />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Town</span>
            <FormInput type="text" name="town" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Routes served</span>
          <FormInput
            type="text"
            name="routes_served"
            placeholder="Johannesburg-Durban, Johannesburg-Cape Town"
          />
          <span className="text-ds-caption text-ds-mute">Comma separated</span>
        </label>

        <Button type="submit" variant="primary" className="w-fit">
          Create hub
        </Button>
      </form>
    </main>
  );
}
