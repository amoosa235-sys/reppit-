import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEngagementMessage, updateEngagementStatus } from "./actions";

type EngagementRow = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  business_user_id: string;
  provider_profiles: { name: string; user_id: string } | null;
};

export default async function EngagementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ engagementId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { engagementId } = await params;
  const searchParamsResolved = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("engagements")
    .select("id, status, started_at, ended_at, notes, business_user_id, provider_profiles(name, user_id)")
    .eq("id", engagementId)
    .maybeSingle();

  const engagement = data as unknown as EngagementRow | null;

  if (!engagement) {
    redirect("/engagements");
  }

  const isBusiness = engagement.business_user_id === user.id;
  const isProvider = engagement.provider_profiles?.user_id === user.id;

  if (!isBusiness && !isProvider) {
    redirect("/engagements");
  }

  const counterpartUserId = isBusiness ? engagement.provider_profiles?.user_id : engagement.business_user_id;

  let counterpartName: string | null = null;
  if (isBusiness) {
    counterpartName = engagement.provider_profiles?.name ?? null;
  } else {
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("user_id", engagement.business_user_id)
      .maybeSingle();
    counterpartName = business?.name ?? null;
  }

  const { data: counterpartAccount } = counterpartUserId
    ? await supabase.from("users").select("email").eq("id", counterpartUserId).maybeSingle()
    : { data: null };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href="/engagements" className="text-sm text-teal-300 underline">
        Back to engagements
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-teal-300">{counterpartName ?? "Engagement"}</h1>
        {counterpartAccount?.email && (
          <p className="text-sm text-navy-100">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {searchParamsResolved.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={updateEngagementStatus} className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <input type="hidden" name="engagement_id" value={engagementId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-100">Status</span>
          <select name="status" defaultValue={engagement.status} className="rounded px-3 py-2 text-navy-900">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-100">Notes</span>
          <textarea
            name="notes"
            defaultValue={engagement.notes ?? ""}
            rows={2}
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Save
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-teal-300">Messages</h2>
        <div className="flex flex-col gap-2">
          {!messages || messages.length === 0 ? (
            <p className="text-sm text-navy-100">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  "max-w-[80%] rounded px-3 py-2 text-sm " +
                  (m.sender_id === user.id ? "self-end bg-teal-700" : "self-start bg-navy-800")
                }
              >
                <p>{m.body}</p>
                <p className="mt-1 text-xs text-navy-200">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>

        <form action={sendEngagementMessage} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <input type="hidden" name="recipient_id" value={counterpartUserId ?? ""} />
          <textarea
            name="body"
            required
            rows={3}
            className="rounded px-3 py-2 text-navy-900"
            placeholder="Write a message..."
          />
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
