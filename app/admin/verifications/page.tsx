import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewProvider } from "./actions";
import { Button } from "@/components/ui";

type PendingDoc = {
  id: string;
  document_type: string;
  submitted_at: string;
  storage_path: string;
  provider_profiles: {
    id: string;
    name: string;
    category: "rep" | "printer" | "distributor";
    tier: string;
    verification_status: string;
    users: { email: string } | null;
  } | null;
};

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Pending verifications</h1>

      {error && <p className="text-ds-body-sm text-red-400">Could not load submissions: {error.message}</p>}
      {params.updated && <p className="text-ds-body-sm text-ds-success">Provider updated.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      {groups.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">Nothing pending review.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ provider, docs: providerDocs }) => (
            <section key={provider.id} className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
              <div>
                <h2 className="font-medium text-ds-ink">{provider.name}</h2>
                <p className="text-ds-caption text-ds-mute">
                  {provider.category} · {provider.users?.email ?? "unknown email"} · current tier:{" "}
                  {provider.tier} · current status: {provider.verification_status}
                </p>
              </div>

              <ul className="flex flex-col gap-1 text-ds-body-sm">
                {providerDocs.map((doc) => (
                  <li key={doc.id}>
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-ds-link underline">
                        {doc.document_type}
                      </a>
                    ) : (
                      <span>{doc.document_type} (link unavailable)</span>
                    )}
                    <span className="text-ds-mute">
                      {" "}
                      · submitted {new Date(doc.submitted_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>

              <form action={reviewProvider} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="provider_id" value={provider.id} />

                <label className="flex flex-col gap-1">
                  <span className="text-ds-caption text-ds-mute">Tier</span>
                  <select name="tier" defaultValue={provider.tier} className={selectClass}>
                    <option value="entry">Entry</option>
                    <option value="verified">Verified</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-ds-caption text-ds-mute">Verification status</span>
                  <select
                    name="verification_status"
                    defaultValue="verified"
                    className={selectClass}
                  >
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="pending">Leave pending</option>
                  </select>
                </label>

                <Button type="submit" variant="primary">
                  Save
                </Button>
              </form>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
