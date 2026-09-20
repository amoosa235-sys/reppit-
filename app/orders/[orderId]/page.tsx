import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateStage, confirmPayment, uploadProof, initializeOrderPayment, sendOrderMessage } from "./actions";
import { Button } from "@/components/ui";

type OrderRow = {
  id: string;
  description: string | null;
  quantity: number | null;
  price_total: number | null;
  currency: string;
  payment_method: string | null;
  payment_status: string;
  proof_of_payment_url: string | null;
  stage: string;
  payment_confirmed_at: string | null;
  created_at: string;
  buyer_user_id: string;
  catalogues: { name: string; business_user_id: string } | null;
  provider_profiles: { name: string; user_id: string } | null;
};

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";
const textareaClass =
  "font-ds-sans bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-ds-sm outline-none focus:border-ds-hairline-tertiary";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ error?: string; paid?: string }>;
}) {
  const { orderId } = await params;
  const searchParamsResolved = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("orders")
    .select(
      "id, description, quantity, price_total, currency, payment_method, payment_status, proof_of_payment_url, stage, payment_confirmed_at, created_at, buyer_user_id, catalogues(name, business_user_id), provider_profiles(name, user_id)",
    )
    .eq("id", orderId)
    .maybeSingle();

  const order = data as unknown as OrderRow | null;

  if (!order) {
    redirect("/orders");
  }

  const isBuyer = order.buyer_user_id === user.id;
  const sellerUserId = order.catalogues?.business_user_id ?? order.provider_profiles?.user_id ?? null;
  const isSeller = sellerUserId === user.id;

  if (!isBuyer && !isSeller) {
    redirect("/orders");
  }

  const counterpartUserId = isBuyer ? sellerUserId : order.buyer_user_id;

  let counterpartName: string | null = null;
  if (isBuyer) {
    counterpartName = order.catalogues?.name ?? order.provider_profiles?.name ?? null;
  } else {
    const { data: buyerBusiness } = await supabase
      .from("businesses")
      .select("name")
      .eq("user_id", order.buyer_user_id)
      .maybeSingle();
    counterpartName = buyerBusiness?.name ?? null;
  }

  const { data: counterpartAccount } = counterpartUserId
    ? await supabase.from("users").select("email").eq("id", counterpartUserId).maybeSingle()
    : { data: null };

  const { data: history } = await supabase
    .from("order_status_history")
    .select("id, stage, note, changed_at")
    .eq("order_id", orderId)
    .order("changed_at", { ascending: true });

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  let proofUrl: string | null = null;
  if (order.proof_of_payment_url) {
    const { data: signed } = await supabase.storage
      .from("order-proofs")
      .createSignedUrl(order.proof_of_payment_url, 600);
    proofUrl = signed?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <Link href="/orders" className="text-ds-body-sm text-ds-link underline">
        Back to orders
      </Link>

      <div>
        <h1 className="text-ds-display-md">Order with {counterpartName ?? "counterpart"}</h1>
        {counterpartAccount?.email && (
          <p className="text-ds-body text-ds-body-sm">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {searchParamsResolved.paid && <p className="text-ds-body-sm text-ds-success">Payment successful.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <section className="flex flex-col gap-2 rounded-ds-sm border border-ds-hairline p-ds-lg text-ds-body-sm">
        {order.description && <p>{order.description}</p>}
        <p>
          Quantity: {order.quantity ?? "-"} · Total: {order.currency} {order.price_total ?? "-"}
        </p>
        <p className="capitalize">Stage: {order.stage.replace(/_/g, " ")}</p>
        <p className="capitalize">
          Payment: {order.payment_status.replace(/_/g, " ")}
          {order.payment_method && ` (${order.payment_method.replace(/_/g, " ")})`}
        </p>
      </section>

      {order.payment_status === "unpaid" && isBuyer && (
        <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
          <h2 className="text-ds-display-md">Pay for this order</h2>
          <form action={initializeOrderPayment}>
            <input type="hidden" name="order_id" value={orderId} />
            <Button type="submit" variant="primary">
              Pay with Paystack
            </Button>
          </form>
          <form action={uploadProof} className="flex flex-col gap-2">
            <input type="hidden" name="order_id" value={orderId} />
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Or upload proof of an EFT payment</span>
              <input type="file" name="proof" accept="application/pdf,image/jpeg,image/png" required />
            </label>
            <Button type="submit" variant="secondary" className="w-fit">
              Upload proof
            </Button>
          </form>
        </section>
      )}

      {order.payment_status === "pending_proof" && (
        <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
          <h2 className="text-ds-display-md">Proof of payment</h2>
          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="text-ds-body-sm text-ds-link underline">
              View uploaded proof
            </a>
          )}
          {isSeller ? (
            <form action={confirmPayment}>
              <input type="hidden" name="order_id" value={orderId} />
              <Button type="submit" variant="primary">
                Confirm payment received
              </Button>
            </form>
          ) : (
            <p className="text-ds-body text-ds-body-sm">Waiting for the seller to confirm your payment.</p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Progress</h2>

        {isSeller && order.payment_status === "paid" && (
          <form action={updateStage} className="flex items-end gap-3">
            <input type="hidden" name="order_id" value={orderId} />
            <label className="flex flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Update stage</span>
              <select name="stage" defaultValue={order.stage} className={selectClass}>
                <option value="in_progress">In progress</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            </label>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        )}

        {isBuyer && order.stage === "delivered" && (
          <form action={updateStage}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="stage" value="completed" />
            <Button type="submit" variant="primary">
              Mark completed
            </Button>
          </form>
        )}

        {isBuyer && order.stage === "pending" && (
          <form action={updateStage}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="stage" value="cancelled" />
            <button
              type="submit"
              className="font-ds-sans rounded-ds-sm border border-red-400 px-ds-lg py-ds-md text-ds-body-sm font-semibold text-red-400 hover:bg-ds-canvas-level-2"
            >
              Cancel order
            </button>
          </form>
        )}

        {history && history.length > 0 && (
          <ul className="flex flex-col gap-1 text-ds-caption text-ds-mute">
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.changed_at).toLocaleString()} · {h.stage.replace(/_/g, " ")}
                {h.note && ` - ${h.note}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-ds-display-md">Messages</h2>
        <div className="flex flex-col gap-2">
          {!messages || messages.length === 0 ? (
            <p className="text-ds-body text-ds-body-sm">No messages yet.</p>
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

        <form action={sendOrderMessage} className="flex flex-col gap-3">
          <input type="hidden" name="order_id" value={orderId} />
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
      </section>
    </main>
  );
}
