import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startTrial, claimArea, removeArea, initializeEnterpriseCheckout } from "./actions";
import { Button, FormInput } from "@/components/ui";

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  national: "National",
};

export default async function EnterprisePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; started?: string }>;
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

  const { data: plans } = await supabase
    .from("enterprise_plans")
    .select("tier, area_limit, price_monthly_zar, token_discount_pct")
    .order("price_monthly_zar", { ascending: true });

  const { data: subscription } = await supabase
    .from("enterprise_subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_end")
    .eq("business_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: areas } = subscription
    ? await supabase
        .from("enterprise_subscription_areas")
        .select("location_id, locations(province, town)")
        .eq("subscription_id", subscription.id)
    : { data: null };

  const currentPlan = plans?.find((p) => p.tier === subscription?.tier);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Enterprise</h1>

      {params.started && <p className="text-ds-body-sm text-ds-success">Trial started - welcome to Enterprise.</p>}
      {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

      {!subscription ? (
        <section className="flex flex-col gap-3">
          <p className="text-ds-body text-ds-body-md">
            Claim exclusive areas and get {plans?.[0]?.token_discount_pct ?? 50}% off token unlocks within them.
            Starts with a {14}-day free trial.
          </p>
          {(plans ?? []).map((p) => (
            <form
              key={p.tier}
              action={startTrial}
              className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-lg"
            >
              <input type="hidden" name="tier" value={p.tier} />
              <div>
                <p className="font-medium text-ds-ink">{TIER_LABEL[p.tier] ?? p.tier}</p>
                <p className="text-ds-caption text-ds-mute">
                  {p.area_limit != null ? `Up to ${p.area_limit} areas` : "Unlimited areas"} · R
                  {p.price_monthly_zar}/month
                </p>
              </div>
              <Button type="submit" variant="primary">
                Start free trial
              </Button>
            </form>
          ))}
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-ds-sm border border-ds-hairline p-ds-lg text-ds-body-sm text-ds-ink">
            <p>
              Plan: {TIER_LABEL[subscription.tier] ?? subscription.tier} ·{" "}
              <span className="capitalize">{subscription.status}</span>
            </p>
            {subscription.status === "trial" && <p>Trial ends {subscription.trial_ends_at}</p>}
            <p>Current period ends {subscription.current_period_end}</p>
            {currentPlan && (
              <p className="text-ds-mute">
                {currentPlan.area_limit != null ? `Up to ${currentPlan.area_limit} areas` : "Unlimited areas"} · R
                {currentPlan.price_monthly_zar}/month
              </p>
            )}
            {subscription.status !== "active" && (
              <form action={initializeEnterpriseCheckout}>
                <input type="hidden" name="subscription_id" value={subscription.id} />
                <Button type="submit" variant="primary" className="mt-1 w-fit">
                  Subscribe with Paystack
                </Button>
              </form>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-ds-display-md">Claimed areas</h2>

            {!areas || areas.length === 0 ? (
              <p className="text-ds-body text-ds-body-md">No areas claimed yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {areas.map((a) => {
                  const location = a.locations as unknown as { province: string; town: string } | null;
                  return (
                    <li
                      key={a.location_id}
                      className="flex items-center justify-between rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm text-ds-ink"
                    >
                      <span>
                        {location?.town}, {location?.province}
                      </span>
                      <form action={removeArea}>
                        <input type="hidden" name="subscription_id" value={subscription.id} />
                        <input type="hidden" name="location_id" value={a.location_id} />
                        <button type="submit" className="text-ds-caption text-red-400 underline">
                          Remove
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <form action={claimArea} className="flex items-end gap-3">
              <input type="hidden" name="subscription_id" value={subscription.id} />
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Province</span>
                <FormInput type="text" name="province" required />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Town</span>
                <FormInput type="text" name="town" required />
              </label>
              <Button type="submit" variant="primary">
                Claim
              </Button>
            </form>
          </section>
        </>
      )}

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
