import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEngagementMessage, updateEngagementStatus } from "./actions";
import { createStockReport } from "./stock-reports/actions";
import {
  createReturn,
  updateReturnStatus,
  createRefund,
  updateRefundStatus,
  createDamage,
} from "./sales-rep/actions";
import { createCampaign, updateCampaign, uploadMarketingAsset } from "./marketing/actions";
import { setPaymentTerms, setPaymentRecipient } from "./payment-terms/actions";
import { Button, FormInput } from "@/components/ui";

type EngagementRow = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  business_user_id: string;
  provider_profile_id: string;
  provider_profiles: { name: string; user_id: string } | null;
};

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
};

const selectClass =
  "font-ds-sans h-9 bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary";
const smallSelectClass =
  "font-ds-sans h-8 bg-ds-canvas-level-3 text-ds-ink text-ds-caption border border-ds-hairline-secondary rounded-ds-sm px-ds-sm outline-none focus:border-ds-hairline-tertiary";
const textareaClass =
  "font-ds-sans bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-ds-sm outline-none focus:border-ds-hairline-tertiary";

function daysSince(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function EngagementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ engagementId: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { engagementId } = await params;
  const searchParamsResolved = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("engagements")
    .select(
      "id, status, started_at, ended_at, notes, business_user_id, provider_profile_id, provider_profiles(name, user_id)",
    )
    .eq("id", engagementId)
    .maybeSingle();

  const engagement = data as unknown as EngagementRow | null;

  if (!engagement) {
    redirect("/engagements");
  }

  const isBusiness = engagement.business_user_id === user.id;
  const isProvider = engagement.provider_profiles?.user_id === user.id;

  if (!isBusiness && !isProvider) {
    redirect("/engagements");
  }

  const counterpartUserId = isBusiness ? engagement.provider_profiles?.user_id : engagement.business_user_id;

  let counterpartName: string | null = null;
  if (isBusiness) {
    counterpartName = engagement.provider_profiles?.name ?? null;
  } else {
    const { data: business } = await supabase
      .from("businesses")
      .select("name")
      .eq("user_id", engagement.business_user_id)
      .maybeSingle();
    counterpartName = business?.name ?? null;
  }

  const { data: counterpartAccount } = counterpartUserId
    ? await supabase.from("users").select("email").eq("id", counterpartUserId).maybeSingle()
    : { data: null };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: true });

  const { data: stockReports } = await supabase
    .from("stock_reports")
    .select("id, store_location, product_name, sku, quantity_on_shelf, photos, reported_at")
    .eq("engagement_id", engagementId)
    .order("reported_at", { ascending: false });

  const stockReportsWithUrls = await Promise.all(
    (stockReports ?? []).map(async (r) => {
      const urls = await Promise.all(
        (r.photos ?? []).map(async (path: string) => {
          const { data: signed } = await supabase.storage.from("team-management").createSignedUrl(path, 600);
          return signed?.signedUrl ?? null;
        }),
      );
      return { ...r, photoUrls: urls.filter(Boolean) as string[] };
    }),
  );

  const { data: storeReturns } = await supabase
    .from("store_returns")
    .select("id, order_id, store_location, product_name, quantity, reason, status, reported_at")
    .eq("engagement_id", engagementId)
    .order("reported_at", { ascending: false });

  const { data: refunds } = await supabase
    .from("refunds")
    .select("id, order_id, amount, reason, status, processed_by, processed_at, created_at")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });

  const { data: damages } = await supabase
    .from("damages")
    .select("id, order_id, description, photos, reported_at")
    .eq("engagement_id", engagementId)
    .order("reported_at", { ascending: false });

  const damagesWithUrls = await Promise.all(
    (damages ?? []).map(async (d) => {
      const urls = await Promise.all(
        (d.photos ?? []).map(async (path: string) => {
          const { data: signed } = await supabase.storage.from("team-management").createSignedUrl(path, 600);
          return signed?.signedUrl ?? null;
        }),
      );
      return { ...d, photoUrls: urls.filter(Boolean) as string[] };
    }),
  );

  const { data: campaigns } = await supabase
    .from("marketing_campaigns")
    .select("id, name, budget, cost_actual, start_date, end_date, status")
    .eq("engagement_id", engagementId)
    .order("start_date", { ascending: false, nullsFirst: false });

  const campaignsWithAssets = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: assets } = await supabase
        .from("marketing_assets")
        .select("id, asset_type, file_url, uploaded_at")
        .eq("campaign_id", c.id)
        .order("uploaded_at", { ascending: false });

      const assetsWithUrls = await Promise.all(
        (assets ?? []).map(async (a) => {
          const { data: signed } = await supabase.storage
            .from("team-management")
            .createSignedUrl(a.file_url, 600);
          return { ...a, signedUrl: signed?.signedUrl ?? null };
        }),
      );

      return { ...c, assets: assetsWithUrls };
    }),
  );

  const { data: paymentTerms } = await supabase
    .from("engagement_payment_terms")
    .select(
      "payment_type, commission_pct, retainer_amount, frequency, paystack_recipient_code, recipient_added_at",
    )
    .eq("engagement_id", engagementId)
    .maybeSingle();

  let amountOwed: number | null = null;

  if (paymentTerms?.payment_type === "commission" && paymentTerms.commission_pct != null) {
    const { data: matchedOrders } = await supabase
      .from("orders")
      .select("price_total")
      .eq("buyer_user_id", engagement.business_user_id)
      .eq("provider_profile_id", engagement.provider_profile_id)
      .eq("payment_status", "paid")
      .gte("created_at", engagement.started_at);

    const total = (matchedOrders ?? []).reduce((sum, o) => sum + Number(o.price_total ?? 0), 0);
    amountOwed = (total * paymentTerms.commission_pct) / 100;
  } else if (paymentTerms?.payment_type === "retainer" && paymentTerms.retainer_amount != null) {
    const daysElapsed = daysSince(engagement.started_at);
    const periodDays = FREQUENCY_DAYS[paymentTerms.frequency] ?? 30;
    // "per_order" retainer has no natural period length; falls back to a
    // monthly period rather than leaving amount owed uncomputed.
    const periodsElapsed = Math.max(1, Math.floor(daysElapsed / periodDays) + 1);
    amountOwed = paymentTerms.retainer_amount * periodsElapsed;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <Link href="/engagements" className="text-ds-body-sm text-ds-link underline">
        Back to engagements
      </Link>

      <div>
        <h1 className="text-ds-display-md">{counterpartName ?? "Engagement"}</h1>
        {counterpartAccount?.email && (
          <p className="text-ds-body text-ds-body-sm">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {searchParamsResolved.saved && <p className="text-ds-body-sm text-ds-success">Saved.</p>}
      {searchParamsResolved.error && <p className="text-ds-body-sm text-red-400">{searchParamsResolved.error}</p>}

      <form action={updateEngagementStatus} className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <input type="hidden" name="engagement_id" value={engagementId} />

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Status</span>
          <select name="status" defaultValue={engagement.status} className={selectClass}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-ds-caption text-ds-mute">Notes</span>
          <textarea
            name="notes"
            defaultValue={engagement.notes ?? ""}
            rows={2}
            className={textareaClass}
          />
        </label>

        <Button type="submit" variant="primary" className="w-fit">
          Save
        </Button>
      </form>

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

        <form action={sendEngagementMessage} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
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

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Stock reports</h2>

        {stockReportsWithUrls.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No stock reports yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stockReportsWithUrls.map((r) => (
              <li key={r.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
                <p className="font-medium text-ds-ink">
                  {r.product_name ?? "Product"} {r.sku && `(${r.sku})`}
                </p>
                <p className="text-ds-caption text-ds-mute">
                  {r.store_location && `${r.store_location} · `}
                  Qty on shelf: {r.quantity_on_shelf ?? "-"} · {new Date(r.reported_at).toLocaleDateString()}
                </p>
                {r.photoUrls.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {r.photoUrls.map((url) => (
                      <div key={url} className="relative h-16 w-full overflow-hidden rounded-ds-sm">
                        <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={createStockReport} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Store location</span>
              <FormInput type="text" name="store_location" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Product name</span>
              <FormInput type="text" name="product_name" />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">SKU</span>
              <FormInput type="text" name="sku" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Quantity on shelf</span>
              <FormInput type="number" min={0} name="quantity_on_shelf" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Shelf photos</span>
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
            <span className="text-ds-caption text-ds-mute">Up to 4 photos, 5MB each.</span>
          </label>
          <Button type="submit" variant="primary" className="w-fit">
            Submit report
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Store returns</h2>

        {!storeReturns || storeReturns.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No returns reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {storeReturns.map((r) => (
              <li key={r.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
                <p className="font-medium text-ds-ink">
                  {r.product_name ?? "Product"} {r.quantity != null && `· qty ${r.quantity}`}
                </p>
                <p className="text-ds-caption text-ds-mute">
                  {r.store_location && `${r.store_location} · `}
                  {r.reason && `${r.reason} · `}
                  {new Date(r.reported_at).toLocaleDateString()} · status: {r.status}
                </p>
                <form action={updateReturnStatus} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="engagement_id" value={engagementId} />
                  <input type="hidden" name="return_id" value={r.id} />
                  <select name="status" defaultValue={r.status} className={smallSelectClass}>
                    <option value="reported">Reported</option>
                    <option value="processing">Processing</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <Button type="submit" variant="primary">
                    Update
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createReturn} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Store location</span>
              <FormInput type="text" name="store_location" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Product name</span>
              <FormInput type="text" name="product_name" />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Quantity</span>
              <FormInput type="number" min={0} name="quantity" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Order ID (optional)</span>
              <FormInput type="text" name="order_id" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Reason</span>
            <textarea name="reason" rows={2} className={textareaClass} />
          </label>
          <Button type="submit" variant="primary" className="w-fit">
            Report return
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Refunds</h2>

        {!refunds || refunds.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No refunds recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {refunds.map((r) => (
              <li key={r.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
                <p className="font-medium text-ds-ink">R{Number(r.amount).toFixed(2)}</p>
                <p className="text-ds-caption text-ds-mute">
                  {r.reason && `${r.reason} · `}
                  {new Date(r.created_at).toLocaleDateString()} · status: {r.status}
                </p>
                {isBusiness && (
                  <form action={updateRefundStatus} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="engagement_id" value={engagementId} />
                    <input type="hidden" name="refund_id" value={r.id} />
                    <select name="status" defaultValue={r.status} className={smallSelectClass}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </select>
                    <Button type="submit" variant="primary">
                      Update
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={createRefund} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Amount (R)</span>
              <FormInput type="number" min={0} step="0.01" name="amount" required />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Order ID (optional)</span>
              <FormInput type="text" name="order_id" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Reason</span>
            <textarea name="reason" rows={2} className={textareaClass} />
          </label>
          <Button type="submit" variant="primary" className="w-fit">
            Request refund
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Damages</h2>

        {damagesWithUrls.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No damages reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {damagesWithUrls.map((d) => (
              <li key={d.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
                <p>{d.description ?? "Damage report"}</p>
                <p className="text-ds-caption text-ds-mute">{new Date(d.reported_at).toLocaleDateString()}</p>
                {d.photoUrls.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {d.photoUrls.map((url) => (
                      <div key={url} className="relative h-16 w-full overflow-hidden rounded-ds-sm">
                        <Image src={url} alt="" fill sizes="80px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={createDamage} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Order ID (optional)</span>
            <FormInput type="text" name="order_id" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Description</span>
            <textarea name="description" rows={2} className={textareaClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Photos</span>
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
            <span className="text-ds-caption text-ds-mute">Up to 4 photos, 5MB each.</span>
          </label>
          <Button type="submit" variant="primary" className="w-fit">
            Report damage
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Marketing campaigns</h2>

        {campaignsWithAssets.length === 0 ? (
          <p className="text-ds-body text-ds-body-sm">No campaigns yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {campaignsWithAssets.map((c) => (
              <li key={c.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
                <p className="font-medium text-ds-ink">{c.name}</p>
                <p className="text-ds-caption text-ds-mute">
                  {c.start_date && `${c.start_date} → ${c.end_date ?? "?"} · `}
                  Budget: {c.budget != null ? `R${Number(c.budget).toFixed(2)}` : "-"} · Spent: R
                  {Number(c.cost_actual ?? 0).toFixed(2)} · status: {c.status}
                </p>

                <form action={updateCampaign} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="engagement_id" value={engagementId} />
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <select name="status" defaultValue={c.status} className={smallSelectClass}>
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <FormInput
                    type="number"
                    min={0}
                    step="0.01"
                    name="cost_actual"
                    defaultValue={c.cost_actual ?? 0}
                    className="w-28"
                  />
                  <Button type="submit" variant="primary">
                    Update
                  </Button>
                </form>

                {c.assets.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {c.assets.map((a) => (
                      <li key={a.id} className="text-ds-caption text-ds-mute">
                        {a.asset_type === "design" ? "Design" : "Promo material"} ·{" "}
                        {a.signedUrl ? (
                          <a href={a.signedUrl} target="_blank" rel="noreferrer" className="text-ds-link underline">
                            view
                          </a>
                        ) : (
                          "unavailable"
                        )}{" "}
                        · {new Date(a.uploaded_at).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                )}

                <form action={uploadMarketingAsset} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="engagement_id" value={engagementId} />
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <select name="asset_type" defaultValue="design" className={smallSelectClass}>
                    <option value="design">Design</option>
                    <option value="promo_material">Promo material</option>
                  </select>
                  <input type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
                  <Button type="submit" variant="primary">
                    Upload
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createCampaign} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <label className="flex flex-col gap-1">
            <span className="text-ds-caption text-ds-mute">Campaign name</span>
            <FormInput type="text" name="name" required />
          </label>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Budget (R)</span>
              <FormInput type="number" min={0} step="0.01" name="budget" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">Start date</span>
              <FormInput type="date" name="start_date" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-ds-caption text-ds-mute">End date</span>
              <FormInput type="date" name="end_date" />
            </label>
          </div>
          <Button type="submit" variant="primary" className="w-fit">
            Create campaign
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg">
        <h2 className="text-ds-display-md">Payment terms</h2>
        <p className="text-ds-caption text-ds-mute">
          Reference only — Reppit doesn&apos;t move money for engagements. The business pays the provider
          directly, off-platform, using these terms.
        </p>

        {paymentTerms ? (
          <div className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm">
            <p className="font-medium text-ds-ink">
              {paymentTerms.payment_type === "commission"
                ? `${paymentTerms.commission_pct}% commission`
                : `R${Number(paymentTerms.retainer_amount).toFixed(2)} retainer`}{" "}
              · {paymentTerms.frequency.replace("_", " ")}
            </p>
            {amountOwed != null && (
              <p className="mt-1 text-ds-success">Amount owed (calculated): R{amountOwed.toFixed(2)}</p>
            )}
            <p className="mt-2 text-ds-caption text-ds-mute">
              Payout recipient:{" "}
              {paymentTerms.paystack_recipient_code
                ? `registered ${new Date(paymentTerms.recipient_added_at!).toLocaleDateString()}`
                : "not registered yet"}
            </p>
          </div>
        ) : (
          <p className="text-ds-body text-ds-body-sm">No payment terms set yet.</p>
        )}

        {isBusiness && (
          <form action={setPaymentTerms} className="flex flex-col gap-3">
            <input type="hidden" name="engagement_id" value={engagementId} />
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Payment type</span>
                <select
                  name="payment_type"
                  defaultValue={paymentTerms?.payment_type ?? "commission"}
                  className={selectClass}
                >
                  <option value="commission">Commission</option>
                  <option value="retainer">Retainer</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Frequency</span>
                <select
                  name="frequency"
                  defaultValue={paymentTerms?.frequency ?? "monthly"}
                  className={selectClass}
                >
                  <option value="per_order">Per order</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            </div>
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Commission %</span>
                <FormInput
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  name="commission_pct"
                  defaultValue={paymentTerms?.commission_pct ?? ""}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Retainer amount (R)</span>
                <FormInput
                  type="number"
                  min={0}
                  step="0.01"
                  name="retainer_amount"
                  defaultValue={paymentTerms?.retainer_amount ?? ""}
                />
              </label>
            </div>
            <Button type="submit" variant="primary" className="w-fit">
              {paymentTerms ? "Update terms" : "Set terms"}
            </Button>
          </form>
        )}

        {isProvider && paymentTerms && (
          <form action={setPaymentRecipient} className="flex flex-col gap-3 border-t border-ds-hairline pt-3">
            <input type="hidden" name="engagement_id" value={engagementId} />
            <p className="text-ds-caption text-ds-mute">
              Register your bank account with Paystack to receive a payout reference. Reppit never stores your
              account details — only the reference Paystack returns.
            </p>
            <div className="flex gap-4">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Account holder name</span>
                <FormInput type="text" name="account_name" required />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Account number</span>
                <FormInput type="text" name="account_number" required />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-ds-caption text-ds-mute">Bank code</span>
                <FormInput type="text" name="bank_code" required />
              </label>
            </div>
            <Button type="submit" variant="primary" className="w-fit">
              {paymentTerms.paystack_recipient_code ? "Re-register recipient" : "Register recipient"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
