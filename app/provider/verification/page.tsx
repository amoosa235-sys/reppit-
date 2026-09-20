import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitDocument } from "./actions";
import { Button } from "@/components/ui";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ProviderVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, tier, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile) {
    redirect("/provider/profile?error=" + encodeURIComponent("Create your provider profile first."));
  }

  const { data: documents } = await supabase
    .from("verification_documents")
    .select("id, document_type, status, submitted_at")
    .eq("provider_id", providerProfile.id)
    .order("submitted_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Verification</h1>

      <p className="text-ds-body-sm text-ds-body">
        Tier: {providerProfile.tier} · Status: {STATUS_LABEL[providerProfile.verification_status] ?? providerProfile.verification_status}
      </p>

      {params.submitted && <p className="text-ds-body-sm text-ds-success">Document submitted for review.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-ds-display-md">Submitted documents</h2>
        {!documents || documents.length === 0 ? (
          <p className="text-ds-body-sm text-ds-body">No documents submitted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded-ds-sm border border-ds-hairline p-ds-lg text-ds-body-sm text-ds-ink">
                <span className="font-medium">{doc.document_type}</span>
                {" · "}
                <span>{STATUS_LABEL[doc.status] ?? doc.status}</span>
                {" · "}
                <span className="text-ds-mute">
                  {new Date(doc.submitted_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={submitDocument} className="flex flex-col gap-4 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Submit a document</h2>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Document type</span>
          <select
            name="document_type"
            className="font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary"
            defaultValue="ID document"
          >
            <option>ID document</option>
            <option>Business registration</option>
            <option>Proof of address</option>
            <option>Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">File</span>
          <input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required className="text-ds-body-sm text-ds-body" />
          <span className="text-ds-caption text-ds-mute">PDF, JPEG, or PNG. Max 10MB.</span>
        </label>

        <Button type="submit" variant="primary">
          Submit for review
        </Button>
      </form>
    </main>
  );
}
