import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendMessage, submitRating, createOrder, createEngagement } from "./actions";
import { Button, FormInput } from "@/components/ui";

type UnlockRow = {
  id: string;
  provider_id: string | null;
  catalogue_id: string | null;
  businesses: { user_id: string; name: string } | null;
  provider_profiles: { user_id: string; name: string } | null;
  catalogues: { business_user_id: string; name: string } | null;
};

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";
const textareaClass =
  "font-ds-sans bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-ds-sm outline-none focus:border-ds-hairline-tertiary";

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
    .select(
      "id, provider_id, catalogue_id, businesses(user_id, name), provider_profiles(user_id, name), catalogues(business_user_id, name)",
    )
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

  const businessUserId = unlock.businesses?.user_id;
  let ordersQuery = supabase
    .from("orders")
    .select("id, stage, price_total, created_at")
    .eq("buyer_user_id", businessUserId ?? "")
    .order("created_at", { ascending: false });
  ordersQuery = isCatalogueUnlock
    ? ordersQuery.eq("catalogue_id", unlock.catalogue_id ?? "")
    : ordersQuery.eq("provider_profile_id", unlock.provider_id ?? "");
  const { data: orders } = await ordersQuery;

  const { data: engagements } = !isCatalogueUnlock
    ? await supabase
        .from("engagements")
        .select("id, status, started_at")
        .eq("unlock_id", unlockId)
        .order("started_at", { ascending: false })
    : { data: null };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <div>
        <h1 className="text-ds-display-md">{counterpartName ?? "Conversation"}</h1>
        {counterpartAccount?.email && (
          <p className="text-ds-body text-ds-body-sm">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {errorParam && <p className="text-ds-body-sm text-red-400">{errorParam}</p>}

      <div className="flex flex-col gap-2">
        {!messages || messages.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No messages yet - say hello.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                "max-w-[80%] rounded-ds-sm px-ds-lg py-ds-md text-ds-body-sm " +
                (m.sender_id === user.id ? "self-end bg-ds-canvas-level-3" : "self-start bg-ds-canvas-level-2")
              }
            >
              <p>{m.body}</p>
              <p className="mt-1 text-ds-caption text-ds-mute">{new Date(m.created_at).toLocaleString()}</p>
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
          className={textareaClass}
          placeholder="Write a message..."
        />
        <Button type="submit" variant="primary" className="w-fit">
          Send
        </Button>
      </form>

      {!isCatalogueUnlock && (
      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Rating</h2>

        {myRating ? (
          <p className="text-ds-body text-ds-body-sm">
            You rated {counterpartName ?? "them"}: {myRating.rating}/5
            {myRating.comment && ` - "${myRating.comment}"`}
          </p>
        ) : (
          <form action={submitRating} className="flex flex-col gap-2">
            <input type="hidden" name="unlock_id" value={unlockId} />
            <input type="hidden" name="ratee_id" value={counterpartUserId ?? ""} />
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Rate {counterpartName ?? "them"}</span>
              <select name="rating" required defaultValue="5" className={selectClass}>
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
              className={textareaClass}
            />
            <Button type="submit" variant="primary" className="w-fit">
              Submit rating
            </Button>
          </form>
        )}

        {theirRating && (
          <p className="text-ds-body-sm text-ds-mute">
            {counterpartName ?? "They"} rated you: {theirRating.rating}/5
            {theirRating.comment && ` - "${theirRating.comment}"`}
          </p>
        )}
      </section>
      )}

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Orders</h2>

        {!orders || orders.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm hover:border-ds-hairline-secondary"
                >
                  <span className="capitalize">{o.stage.replace(/_/g, " ")}</span>
                  <span>R{o.price_total}</span>
                  <span className="text-ds-mute">{new Date(o.created_at).toLocaleDateString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {isBusiness && (
          <form action={createOrder} className="flex flex-col gap-2">
            <input type="hidden" name="unlock_id" value={unlockId} />
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Description</span>
              <textarea name="description" rows={2} className={textareaClass} />
            </label>
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Quantity</span>
                <FormInput type="number" min={0} name="quantity" />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Total price (R)</span>
                <FormInput
                  type="number"
                  min={0}
                  step="0.01"
                  name="price_total"
                  required
                />
              </label>
            </div>
            <Button type="submit" variant="primary" className="w-fit">
              Create order
            </Button>
          </form>
        )}
      </section>

      {!isCatalogueUnlock && (
        <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
          <h2 className="text-ds-display-md">Engagement</h2>

          {!engagements || engagements.length === 0 ? (
            <>
              <p className="text-ds-body text-ds-body-sm">
                No ongoing engagement yet - a one-off unlock, not a long-term relationship.
              </p>
              {isBusiness && (
                <form action={createEngagement}>
                  <input type="hidden" name="unlock_id" value={unlockId} />
                  <Button type="submit" variant="primary" className="w-fit">
                    Start engagement (Enterprise)
                  </Button>
                </form>
              )}
            </>
          ) : (
            <ul className="flex flex-col gap-2">
              {engagements.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/engagements/${e.id}`}
                    className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm hover:border-ds-hairline-secondary"
                  >
                    <span className="capitalize">{e.status}</span>
                    <span className="text-ds-mute">{new Date(e.started_at).toLocaleDateString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
