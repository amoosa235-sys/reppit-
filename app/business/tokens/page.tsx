import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { initializePurchase } from "./actions";
import { Button } from "@/components/ui";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Tokens</h1>

      <p className="text-ds-display-md">Balance: {balance?.balance ?? 0} tokens</p>

      {params.purchased && <p className="text-ds-body-sm text-ds-success">Purchase successful - tokens credited.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-ds-display-md">Buy tokens</h2>
        {!packs || packs.length === 0 ? (
          <p className="text-ds-body text-ds-body-md">No token packs are available right now.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {packs.map((pack) => (
              <form
                key={pack.id}
                action={initializePurchase}
                className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg"
              >
                <input type="hidden" name="pack_id" value={pack.id} />
                <div>
                  <p className="font-medium text-ds-ink">{pack.name}</p>
                  <p className="text-ds-body-sm text-ds-mute">
                    {pack.token_count} tokens · {formatRands(pack.price_cents)}
                  </p>
                </div>
                <Button type="submit" variant="primary">
                  Buy
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-ds-display-md">Recent activity</h2>
        {!transactions || transactions.length === 0 ? (
          <p className="text-ds-body text-ds-body-md">No token activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-ds-body-sm">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between rounded-ds-sm border border-ds-hairline px-ds-lg py-ds-md">
                <span className="capitalize">{tx.type}</span>
                <span>{tx.type === "spend" ? "-" : "+"}{tx.token_count}</span>
                <span className="text-ds-mute">{new Date(tx.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
