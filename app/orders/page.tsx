import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type OrderSummary = {
  id: string;
  stage: string;
  payment_status: string;
  price_total: number | null;
  currency: string;
  created_at: string;
  catalogues: { name: string } | null;
  provider_profiles: { name: string } | null;
};

function OrderList({ orders, emptyText }: { orders: OrderSummary[] | null; emptyText: string }) {
  if (!orders || orders.length === 0) {
    return <p className="text-sm text-navy-100">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/orders/${o.id}`}
            className="flex items-center justify-between rounded border border-navy-500 p-3 text-sm hover:bg-navy-800"
          >
            <span>{o.catalogues?.name ?? o.provider_profiles?.name ?? "Order"}</span>
            <span className="capitalize">{o.stage.replace(/_/g, " ")}</span>
            <span>
              {o.currency} {o.price_total ?? "-"}
            </span>
            <span className="text-navy-200">{new Date(o.created_at).toLocaleDateString()}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OrdersPage() {
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

  const orderFields =
    "id, stage, payment_status, price_total, currency, created_at, catalogues(name), provider_profiles(name)";

  let buyerOrders: OrderSummary[] | null = null;
  let catalogueSellerOrders: OrderSummary[] | null = null;
  let providerSellerOrders: OrderSummary[] | null = null;

  if (account?.role === "business") {
    const { data } = await supabase
      .from("orders")
      .select(orderFields)
      .eq("buyer_user_id", user.id)
      .order("created_at", { ascending: false });
    buyerOrders = data as unknown as OrderSummary[] | null;

    const { data: sellerData } = await supabase
      .from("orders")
      .select(orderFields + ", catalogues!inner(business_user_id)")
      .eq("catalogues.business_user_id", user.id)
      .order("created_at", { ascending: false });
    catalogueSellerOrders = sellerData as unknown as OrderSummary[] | null;
  }

  if (account?.role === "provider") {
    const { data } = await supabase
      .from("orders")
      .select(orderFields + ", provider_profiles!inner(user_id)")
      .eq("provider_profiles.user_id", user.id)
      .order("created_at", { ascending: false });
    providerSellerOrders = data as unknown as OrderSummary[] | null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Orders</h1>

      {account?.role === "business" && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-teal-300">Orders you placed</h2>
            <OrderList orders={buyerOrders} emptyText="You haven't placed any orders yet." />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-semibold text-teal-300">Orders on your catalogues</h2>
            <OrderList orders={catalogueSellerOrders} emptyText="No orders on your catalogues yet." />
          </section>
        </>
      )}

      {account?.role === "provider" && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-teal-300">Orders for your services</h2>
          <OrderList orders={providerSellerOrders} emptyText="No orders yet." />
        </section>
      )}

      <Link href="/dashboard" className="text-sm text-teal-300 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
