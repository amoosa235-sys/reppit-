"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCatalogue(formData: FormData) {
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

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!name) {
    redirect("/business/catalogues/new?error=" + encodeURIComponent("Catalogue name is required."));
  }
  if (role !== "manufacturer" && role !== "distributor" && role !== "both") {
    redirect("/business/catalogues/new?error=" + encodeURIComponent("Choose a catalogue type."));
  }

  const { data: catalogue, error } = await supabase
    .from("catalogues")
    .insert({ business_user_id: user.id, name, role })
    .select("id")
    .single();

  if (error || !catalogue) {
    redirect(
      "/business/catalogues/new?error=" + encodeURIComponent(error?.message ?? "Could not create catalogue."),
    );
  }

  redirect(`/business/catalogues/${catalogue.id}`);
}
