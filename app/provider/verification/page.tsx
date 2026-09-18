import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { submitDocument } from "./actions";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Verification</h1>

      <p className="text-sm text-navy-100">
        Tier: {providerProfile.tier} · Status: {STATUS_LABEL[providerProfile.verification_status] ?? providerProfile.verification_status}
      </p>

      {params.submitted && <p className="text-sm text-teal-300">Document submitted for review.</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-teal-300">Submitted documents</h2>
        {!documents || documents.length === 0 ? (
          <p className="text-sm text-navy-100">No documents submitted yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="rounded border border-navy-500 p-3 text-sm">
                <span className="font-medium">{doc.document_type}</span>
                {" · "}
                <span>{STATUS_LABEL[doc.status] ?? doc.status}</span>
                {" · "}
                <span className="text-navy-200">
                  {new Date(doc.submitted_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={submitDocument} className="flex flex-col gap-4 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Submit a document</h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Document type</span>
          <select name="document_type" className="rounded px-3 py-2 text-navy-900" defaultValue="ID document">
            <option>ID document</option>
            <option>Business registration</option>
            <option>Proof of address</option>
            <option>Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">File</span>
          <input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required />
          <span className="text-xs text-navy-200">PDF, JPEG, or PNG. Max 10MB.</span>
        </label>

        <button
          type="submit"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Submit for review
        </button>
      </form>
    </main>
  );
}
