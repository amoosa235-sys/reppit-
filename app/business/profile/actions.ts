"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveBusinessProfile(formData: FormData) {
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

  if (!name) {
    redirect("/business/profile?error=" + encodeURIComponent("Business name is required."));
  }

  const industry = String(formData.get("industry") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const province = String(formData.get("province") ?? "").trim() || null;
  const town = String(formData.get("town") ?? "").trim() || null;

  const { error } = await supabase
    .from("businesses")
    .upsert({ user_id: user.id, name, industry, description, province, town }, { onConflict: "user_id" });

  if (error) {
    redirect("/business/profile?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/business/profile");
  redirect("/business/profile?saved=1");
}
