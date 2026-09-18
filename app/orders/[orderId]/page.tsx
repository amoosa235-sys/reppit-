import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateStage, confirmPayment, uploadProof, initializeOrderPayment, sendOrderMessage } from "./actions";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href="/orders" className="text-sm text-teal-300 underline">
        Back to orders
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-teal-300">Order with {counterpartName ?? "counterpart"}</h1>
        {counterpartAccount?.email && (
          <p className="text-sm text-navy-100">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {searchParamsResolved.paid && <p className="text-sm text-teal-300">Payment successful.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <section className="flex flex-col gap-2 rounded border border-navy-500 p-4 text-sm">
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
        <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
          <h2 className="font-semibold text-teal-300">Pay for this order</h2>
          <form action={initializeOrderPayment}>
            <input type="hidden" name="order_id" value={orderId} />
            <button
              type="submit"
              className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Pay with Paystack
            </button>
          </form>
          <form action={uploadProof} className="flex flex-col gap-2">
            <input type="hidden" name="order_id" value={orderId} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Or upload proof of an EFT payment</span>
              <input type="file" name="proof" accept="application/pdf,image/jpeg,image/png" required />
            </label>
            <button
              type="submit"
              className="w-fit rounded border border-teal-300 px-4 py-2 text-sm font-semibold text-teal-300 hover:bg-navy-800"
            >
              Upload proof
            </button>
          </form>
        </section>
      )}

      {order.payment_status === "pending_proof" && (
        <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
          <h2 className="font-semibold text-teal-300">Proof of payment</h2>
          {proofUrl && (
            <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sm text-teal-300 underline">
              View uploaded proof
            </a>
          )}
          {isSeller ? (
            <form action={confirmPayment}>
              <input type="hidden" name="order_id" value={orderId} />
              <button
                type="submit"
                className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
              >
                Confirm payment received
              </button>
            </form>
          ) : (
            <p className="text-sm text-navy-100">Waiting for the seller to confirm your payment.</p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Progress</h2>

        {isSeller && order.payment_status === "paid" && (
          <form action={updateStage} className="flex items-end gap-3">
            <input type="hidden" name="order_id" value={orderId} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-navy-100">Update stage</span>
              <select name="stage" defaultValue={order.stage} className="rounded px-3 py-2 text-navy-900">
                <option value="in_progress">In progress</option>
                <option value="dispatched">Dispatched</option>
                <option value="delivered">Delivered</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Save
            </button>
          </form>
        )}

        {isBuyer && order.stage === "delivered" && (
          <form action={updateStage}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="stage" value="completed" />
            <button
              type="submit"
              className="rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Mark completed
            </button>
          </form>
        )}

        {isBuyer && order.stage === "pending" && (
          <form action={updateStage}>
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="stage" value="cancelled" />
            <button
              type="submit"
              className="rounded border border-red-400 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-navy-800"
            >
              Cancel order
            </button>
          </form>
        )}

        {history && history.length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-navy-200">
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

        <form action={sendOrderMessage} className="flex flex-col gap-3">
          <input type="hidden" name="order_id" value={orderId} />
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
