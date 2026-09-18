import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "./actions";

type UnlockRow = {
  id: string;
  businesses: { user_id: string; name: string } | null;
  provider_profiles: { user_id: string; name: string } | null;
};

export default async function MessageThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ unlockId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { unlockId } = await params;
  const { error: errorParam } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("unlocks")
    .select("id, businesses(user_id, name), provider_profiles(user_id, name)")
    .eq("id", unlockId)
    .maybeSingle();

  const unlock = data as unknown as UnlockRow | null;

  if (!unlock) {
    redirect("/dashboard");
  }

  const isBusiness = unlock.businesses?.user_id === user.id;
  const isProvider = unlock.provider_profiles?.user_id === user.id;

  if (!isBusiness && !isProvider) {
    redirect("/dashboard");
  }

  const counterpartUserId = isBusiness ? unlock.provider_profiles?.user_id : unlock.businesses?.user_id;
  const counterpartName = isBusiness ? unlock.provider_profiles?.name : unlock.businesses?.name;

  const { data: counterpartAccount } = counterpartUserId
    ? await supabase.from("users").select("email").eq("id", counterpartUserId).maybeSingle()
    : { data: null };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("unlock_id", unlockId)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <div>
        <h1 className="text-2xl font-bold text-teal-300">{counterpartName ?? "Conversation"}</h1>
        {counterpartAccount?.email && (
          <p className="text-sm text-navy-100">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {errorParam && <p className="text-sm text-red-300">{errorParam}</p>}

      <div className="flex flex-col gap-2">
        {!messages || messages.length === 0 ? (
          <p className="text-sm text-navy-100">No messages yet - say hello.</p>
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

      <form action={sendMessage} className="flex flex-col gap-3">
        <input type="hidden" name="unlock_id" value={unlockId} />
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
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Send
        </button>
      </form>

      <Link href="/dashboard" className="text-sm text-teal-300 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
