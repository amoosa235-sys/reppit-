import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ANNUAL_FEE_CENTS } from "@/lib/subscriptions";
import { initializeSubscription } from "./actions";
import { Button } from "@/components/ui";

function formatRands(cents: number) {
  return `R${(cents / 100).toFixed(2)}`;
}

const TIER_LABEL: Record<string, string> = {
  entry: "Entry",
  verified: "Verified",
  premium: "Premium",
};

export default async function ProviderSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; subscribed?: string }>;
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, tier")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!providerProfile) {
    redirect("/provider/profile?error=" + encodeURIComponent("Create your provider profile first."));
  }

  const { data: subscription } = await supabase
    .from("provider_subscriptions")
    .select("tier, status, expires_at")
    .eq("provider_id", providerProfile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Annual subscription</h1>

      <p className="text-ds-body-sm text-ds-body">
        Profile tier: {TIER_LABEL[providerProfile.tier] ?? providerProfile.tier} (set by manual verification)
      </p>

      {subscription ? (
        <p className="text-ds-body-sm text-ds-body">
          Latest payment: {TIER_LABEL[subscription.tier]} · {subscription.status}
          {subscription.expires_at &&
            ` · expires ${new Date(subscription.expires_at).toLocaleDateString()}`}
        </p>
      ) : (
        <p className="text-ds-body-sm text-ds-body">No annual fee paid yet.</p>
      )}

      {params.subscribed && <p className="text-ds-body-sm text-ds-success">Payment successful.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      <section className="flex flex-col gap-3">
        <h2 className="text-ds-display-md">Pay the annual fee</h2>
        {(["verified", "premium"] as const).map((tier) => (
          <form
            key={tier}
            action={initializeSubscription}
            className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg"
          >
            <input type="hidden" name="tier" value={tier} />
            <div>
              <p className="font-medium text-ds-ink">{TIER_LABEL[tier]}</p>
              <p className="text-ds-body-sm text-ds-mute">{formatRands(ANNUAL_FEE_CENTS[tier])} / year</p>
            </div>
            <Button type="submit" variant="primary">
              Pay
            </Button>
          </form>
        ))}
      </section>

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
