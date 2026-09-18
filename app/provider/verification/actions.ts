"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export async function submitDocument(formData: FormData) {
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile) {
    redirect("/provider/profile?error=" + encodeURIComponent("Create your provider profile first."));
  }

  const documentType = String(formData.get("document_type") ?? "").trim() || "Other";
  const file = formData.get("document");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/provider/verification?error=" + encodeURIComponent("Choose a file to upload."));
  }

  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    redirect(
      "/provider/verification?error=" +
        encodeURIComponent("Unsupported file type - use PDF, JPEG, or PNG."),
    );
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    redirect("/provider/verification?error=" + encodeURIComponent("File too large (max 10MB)."));
  }

  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("verification-documents")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    redirect("/provider/verification?error=" + encodeURIComponent(uploadError.message));
  }

  const { error: insertError } = await supabase.from("verification_documents").insert({
    provider_id: providerProfile.id,
    storage_path: path,
    document_type: documentType,
  });

  if (insertError) {
    redirect("/provider/verification?error=" + encodeURIComponent(insertError.message));
  }

  revalidatePath("/provider/verification");
  redirect("/provider/verification?submitted=1");
}
