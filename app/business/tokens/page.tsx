import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializePurchase } from "./actions";

function formatRands(cents: number) {
  return `R${(cents / 100).toFixed(2)}`;
}

export default async function TokensPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; purchased?: string }>;
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

  if (account?.role !== "business") {
    redirect("/dashboard");
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!business) {
    redirect("/business/profile?error=" + encodeURIComponent("Complete your business profile first."));
  }

  const [{ data: balance }, { data: packs }, { data: transactions }] = await Promise.all([
    supabase.from("token_balances").select("balance").eq("business_id", business.id).maybeSingle(),
    supabase.from("token_packs").select("id, name, token_count, price_cents").eq("active", true).order("price_cents"),
    supabase
      .from("token_transactions")
      .select("id, type, token_count, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Tokens</h1>

      <p className="text-lg text-navy-100">Balance: {balance?.balance ?? 0} tokens</p>

      {params.purchased && <p className="text-sm text-teal-300">Purchase successful - tokens credited.</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-teal-300">Buy tokens</h2>
        {!packs || packs.length === 0 ? (
          <p className="text-sm text-navy-100">No token packs are available right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {packs.map((pack) => (
              <form
                key={pack.id}
                action={initializePurchase}
                className="flex items-center justify-between rounded border border-navy-500 p-4"
              >
                <input type="hidden" name="pack_id" value={pack.id} />
                <div>
                  <p className="font-medium">{pack.name}</p>
                  <p className="text-sm text-navy-200">
                    {pack.token_count} tokens · {formatRands(pack.price_cents)}
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
                >
                  Buy
                </button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-teal-300">Recent activity</h2>
        {!transactions || transactions.length === 0 ? (
          <p className="text-sm text-navy-100">No token activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between rounded border border-navy-500 px-3 py-2">
                <span className="capitalize">{tx.type}</span>
                <span>{tx.type === "spend" ? "-" : "+"}{tx.token_count}</span>
                <span className="text-navy-200">{new Date(tx.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/dashboard" className="text-sm text-teal-300 underline">
        Back to dashboard
      </Link>
    </main>
  );
}
