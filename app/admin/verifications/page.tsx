import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewProvider } from "./actions";

type PendingDoc = {
  id: string;
  document_type: string;
  submitted_at: string;
  storage_path: string;
  provider_profiles: {
    id: string;
    name: string;
    category: "rep" | "printer";
    tier: string;
    verification_status: string;
    users: { email: string } | null;
  } | null;
};

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
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

  if (account?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data, error } = await supabase
    .from("verification_documents")
    .select(
      "id, document_type, submitted_at, storage_path, provider_profiles(id, name, category, tier, verification_status, users(email))",
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  const docs = (data ?? []) as unknown as PendingDoc[];

  const byProvider = new Map<
    string,
    { provider: NonNullable<PendingDoc["provider_profiles"]>; docs: PendingDoc[] }
  >();

  for (const doc of docs) {
    if (!doc.provider_profiles) continue;
    const key = doc.provider_profiles.id;
    if (!byProvider.has(key)) {
      byProvider.set(key, { provider: doc.provider_profiles, docs: [] });
    }
    byProvider.get(key)!.docs.push(doc);
  }

  const groups = await Promise.all(
    [...byProvider.values()].map(async ({ provider, docs: providerDocs }) => {
      const signedDocs = await Promise.all(
        providerDocs.map(async (doc) => {
          const { data: signed } = await supabase.storage
            .from("verification-documents")
            .createSignedUrl(doc.storage_path, 600);
          return { ...doc, url: signed?.signedUrl ?? null };
        }),
      );
      return { provider, docs: signedDocs };
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Pending verifications</h1>

      {error && <p className="text-sm text-red-300">Could not load submissions: {error.message}</p>}
      {params.updated && <p className="text-sm text-teal-300">Provider updated.</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      {groups.length === 0 ? (
        <p className="text-navy-100">Nothing pending review.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ provider, docs: providerDocs }) => (
            <section key={provider.id} className="flex flex-col gap-3 rounded border border-navy-500 p-4">
              <div>
                <h2 className="font-semibold">{provider.name}</h2>
                <p className="text-xs text-navy-200">
                  {provider.category} · {provider.users?.email ?? "unknown email"} · current tier:{" "}
                  {provider.tier} · current status: {provider.verification_status}
                </p>
              </div>

              <ul className="flex flex-col gap-1 text-sm">
                {providerDocs.map((doc) => (
                  <li key={doc.id}>
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-teal-300 underline">
                        {doc.document_type}
                      </a>
                    ) : (
                      <span>{doc.document_type} (link unavailable)</span>
                    )}
                    <span className="text-navy-200">
                      {" "}
                      · submitted {new Date(doc.submitted_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>

              <form action={reviewProvider} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="provider_id" value={provider.id} />

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-navy-100">Tier</span>
                  <select name="tier" defaultValue={provider.tier} className="rounded px-3 py-2 text-navy-900">
                    <option value="entry">Entry</option>
                    <option value="verified">Verified</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-navy-100">Verification status</span>
                  <select
                    name="verification_status"
                    defaultValue="verified"
                    className="rounded px-3 py-2 text-navy-900"
                  >
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="pending">Leave pending</option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
                >
                  Save
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
