import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMessage, submitRating } from "./actions";

type UnlockRow = {
  id: string;
  businesses: { user_id: string; name: string } | null;
  provider_profiles: { user_id: string; name: string } | null;
  catalogues: { business_user_id: string; name: string } | null;
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
    .select("id, businesses(user_id, name), provider_profiles(user_id, name), catalogues(business_user_id, name)")
    .eq("id", unlockId)
    .maybeSingle();

  const unlock = data as unknown as UnlockRow | null;

  if (!unlock) {
    redirect("/dashboard");
  }

  const isCatalogueUnlock = unlock.catalogues !== null;

  const isBusiness = unlock.businesses?.user_id === user.id;
  const isProvider = !isCatalogueUnlock && unlock.provider_profiles?.user_id === user.id;
  const isCatalogueOwner = isCatalogueUnlock && unlock.catalogues?.business_user_id === user.id;

  if (!isBusiness && !isProvider && !isCatalogueOwner) {
    redirect("/dashboard");
  }

  const counterpartUserId = isCatalogueUnlock
    ? isBusiness
      ? unlock.catalogues?.business_user_id
      : unlock.businesses?.user_id
    : isBusiness
      ? unlock.provider_profiles?.user_id
      : unlock.businesses?.user_id;

  const counterpartName = isCatalogueUnlock
    ? isBusiness
      ? unlock.catalogues?.name
      : unlock.businesses?.name
    : isBusiness
      ? unlock.provider_profiles?.name
      : unlock.businesses?.name;

  const { data: counterpartAccount } = counterpartUserId
    ? await supabase.from("users").select("email").eq("id", counterpartUserId).maybeSingle()
    : { data: null };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("unlock_id", unlockId)
    .order("created_at", { ascending: true });

  // Ratings only support provider unlocks (RLS enforces this too) - v1
  // scope was "business rates provider, provider rates business", and a
  // catalogue unlock has no equivalent yet.
  const { data: myRating } = isCatalogueUnlock
    ? { data: null }
    : await supabase
        .from("ratings")
        .select("rating, comment")
        .eq("unlock_id", unlockId)
        .eq("rater_id", user.id)
        .maybeSingle();

  const { data: theirRating } =
    !isCatalogueUnlock && counterpartUserId
      ? await supabase
          .from("ratings")
          .select("rating, comment")
          .eq("unlock_id", unlockId)
          .eq("rater_id", counterpartUserId)
          .maybeSingle()
      : { data: null };

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

      {!isCatalogueUnlock && (
      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Rating</h2>

        {myRating ? (
          <p className="text-sm text-navy-100">
            You rated {counterpartName ?? "them"}: {myRating.rating}/5
            {myRating.comment && ` - "${myRating.comment}"`}
          </p>
        ) : (
          <form action={submitRating} className="flex flex-col gap-2">
            <input type="hidden" name="unlock_id" value={unlockId} />
            <input type="hidden" name="ratee_id" value={counterpartUserId ?? ""} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Rate {counterpartName ?? "them"}</span>
              <select name="rating" required defaultValue="5" className="rounded px-3 py-2 text-navy-900">
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Bad</option>
              </select>
            </label>
            <textarea
              name="comment"
              rows={2}
              placeholder="Optional comment"
              className="rounded px-3 py-2 text-navy-900"
            />
            <button
              type="submit"
              className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Submit rating
            </button>
          </form>
        )}

        {theirRating && (
          <p className="text-sm text-navy-200">
            {counterpartName ?? "They"} rated you: {theirRating.rating}/5
            {theirRating.comment && ` - "${theirRating.comment}"`}
          </p>
        )}
      </section>
      )}

      <Link href="/dashboard" className="text-sm text-teal-300 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
