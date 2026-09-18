"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TIERS = new Set(["entry", "verified", "premium"]);
const STATUSES = new Set(["pending", "verified", "rejected"]);

export async function reviewProvider(formData: FormData) {
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

  if (account?.role !== "admin") {
    redirect("/dashboard");
  }

  const providerId = String(formData.get("provider_id") ?? "");
  const tier = String(formData.get("tier") ?? "");
  const verificationStatus = String(formData.get("verification_status") ?? "");

  if (!providerId || !TIERS.has(tier) || !STATUSES.has(verificationStatus)) {
    redirect("/admin/verifications?error=" + encodeURIComponent("Invalid review submission."));
  }

  const { error: updateError } = await supabase
    .from("provider_profiles")
    .update({ tier, verification_status: verificationStatus })
    .eq("id", providerId);

  if (updateError) {
    redirect("/admin/verifications?error=" + encodeURIComponent(updateError.message));
  }

  if (verificationStatus !== "pending") {
    const documentStatus = verificationStatus === "verified" ? "approved" : "rejected";
    await supabase
      .from("verification_documents")
      .update({ status: documentStatus, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("provider_id", providerId)
      .eq("status", "pending");
  }

  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?updated=1");
}
