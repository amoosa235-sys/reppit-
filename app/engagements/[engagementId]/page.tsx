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

type EngagementRow = {
  id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
  business_user_id: string;
  provider_profiles: { name: string; user_id: string } | null;
};

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
    .select("id, status, started_at, ended_at, notes, business_user_id, provider_profiles(name, user_id)")
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

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <Link href="/engagements" className="text-sm text-teal-300 underline">
        Back to engagements
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-teal-300">{counterpartName ?? "Engagement"}</h1>
        {counterpartAccount?.email && (
          <p className="text-sm text-navy-100">Contact: {counterpartAccount.email}</p>
        )}
      </div>

      {searchParamsResolved.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {searchParamsResolved.error && <p className="text-sm text-red-300">{searchParamsResolved.error}</p>}

      <form action={updateEngagementStatus} className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <input type="hidden" name="engagement_id" value={engagementId} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-100">Status</span>
          <select name="status" defaultValue={engagement.status} className="rounded px-3 py-2 text-navy-900">
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-100">Notes</span>
          <textarea
            name="notes"
            defaultValue={engagement.notes ?? ""}
            rows={2}
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
        >
          Save
        </button>
      </form>

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

        <form action={sendEngagementMessage} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
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

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Stock reports</h2>

        {stockReportsWithUrls.length === 0 ? (
          <p className="text-sm text-navy-100">No stock reports yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stockReportsWithUrls.map((r) => (
              <li key={r.id} className="rounded border border-navy-500 p-3 text-sm">
                <p className="font-medium">
                  {r.product_name ?? "Product"} {r.sku && `(${r.sku})`}
                </p>
                <p className="text-xs text-navy-200">
                  {r.store_location && `${r.store_location} · `}
                  Qty on shelf: {r.quantity_on_shelf ?? "-"} · {new Date(r.reported_at).toLocaleDateString()}
                </p>
                {r.photoUrls.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {r.photoUrls.map((url) => (
                      <div key={url} className="relative h-16 w-full overflow-hidden rounded">
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
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Store location</span>
              <input type="text" name="store_location" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Product name</span>
              <input type="text" name="product_name" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">SKU</span>
              <input type="text" name="sku" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Quantity on shelf</span>
              <input type="number" min={0} name="quantity_on_shelf" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Shelf photos</span>
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
            <span className="text-xs text-navy-200">Up to 4 photos, 5MB each.</span>
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Submit report
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Store returns</h2>

        {!storeReturns || storeReturns.length === 0 ? (
          <p className="text-sm text-navy-100">No returns reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {storeReturns.map((r) => (
              <li key={r.id} className="rounded border border-navy-500 p-3 text-sm">
                <p className="font-medium">
                  {r.product_name ?? "Product"} {r.quantity != null && `· qty ${r.quantity}`}
                </p>
                <p className="text-xs text-navy-200">
                  {r.store_location && `${r.store_location} · `}
                  {r.reason && `${r.reason} · `}
                  {new Date(r.reported_at).toLocaleDateString()} · status: {r.status}
                </p>
                <form action={updateReturnStatus} className="mt-2 flex items-center gap-2">
                  <input type="hidden" name="engagement_id" value={engagementId} />
                  <input type="hidden" name="return_id" value={r.id} />
                  <select name="status" defaultValue={r.status} className="rounded px-2 py-1 text-navy-900">
                    <option value="reported">Reported</option>
                    <option value="processing">Processing</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                  >
                    Update
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createReturn} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Store location</span>
              <input type="text" name="store_location" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Product name</span>
              <input type="text" name="product_name" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Quantity</span>
              <input type="number" min={0} name="quantity" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Order ID (optional)</span>
              <input type="text" name="order_id" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Reason</span>
            <textarea name="reason" rows={2} className="rounded px-3 py-2 text-navy-900" />
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Report return
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Refunds</h2>

        {!refunds || refunds.length === 0 ? (
          <p className="text-sm text-navy-100">No refunds recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {refunds.map((r) => (
              <li key={r.id} className="rounded border border-navy-500 p-3 text-sm">
                <p className="font-medium">R{Number(r.amount).toFixed(2)}</p>
                <p className="text-xs text-navy-200">
                  {r.reason && `${r.reason} · `}
                  {new Date(r.created_at).toLocaleDateString()} · status: {r.status}
                </p>
                {isBusiness && (
                  <form action={updateRefundStatus} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="engagement_id" value={engagementId} />
                    <input type="hidden" name="refund_id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="rounded px-2 py-1 text-navy-900">
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                    >
                      Update
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form action={createRefund} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Amount (R)</span>
              <input type="number" min={0} step="0.01" name="amount" required className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Order ID (optional)</span>
              <input type="text" name="order_id" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Reason</span>
            <textarea name="reason" rows={2} className="rounded px-3 py-2 text-navy-900" />
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Request refund
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Damages</h2>

        {damagesWithUrls.length === 0 ? (
          <p className="text-sm text-navy-100">No damages reported yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {damagesWithUrls.map((d) => (
              <li key={d.id} className="rounded border border-navy-500 p-3 text-sm">
                <p>{d.description ?? "Damage report"}</p>
                <p className="text-xs text-navy-200">{new Date(d.reported_at).toLocaleDateString()}</p>
                {d.photoUrls.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {d.photoUrls.map((url) => (
                      <div key={url} className="relative h-16 w-full overflow-hidden rounded">
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Order ID (optional)</span>
            <input type="text" name="order_id" className="rounded px-3 py-2 text-navy-900" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Description</span>
            <textarea name="description" rows={2} className="rounded px-3 py-2 text-navy-900" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Photos</span>
            <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
            <span className="text-xs text-navy-200">Up to 4 photos, 5MB each.</span>
          </label>
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Report damage
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border border-navy-500 p-4">
        <h2 className="font-semibold text-teal-300">Marketing campaigns</h2>

        {campaignsWithAssets.length === 0 ? (
          <p className="text-sm text-navy-100">No campaigns yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {campaignsWithAssets.map((c) => (
              <li key={c.id} className="rounded border border-navy-500 p-3 text-sm">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-navy-200">
                  {c.start_date && `${c.start_date} → ${c.end_date ?? "?"} · `}
                  Budget: {c.budget != null ? `R${Number(c.budget).toFixed(2)}` : "-"} · Spent: R
                  {Number(c.cost_actual ?? 0).toFixed(2)} · status: {c.status}
                </p>

                <form action={updateCampaign} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="engagement_id" value={engagementId} />
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <select name="status" defaultValue={c.status} className="rounded px-2 py-1 text-navy-900">
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    name="cost_actual"
                    defaultValue={c.cost_actual ?? 0}
                    className="w-28 rounded px-2 py-1 text-navy-900"
                  />
                  <button
                    type="submit"
                    className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                  >
                    Update
                  </button>
                </form>

                {c.assets.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {c.assets.map((a) => (
                      <li key={a.id} className="text-xs text-navy-200">
                        {a.asset_type === "design" ? "Design" : "Promo material"} ·{" "}
                        {a.signedUrl ? (
                          <a href={a.signedUrl} target="_blank" rel="noreferrer" className="text-teal-300 underline">
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
                  <select name="asset_type" defaultValue="design" className="rounded px-2 py-1 text-navy-900">
                    <option value="design">Design</option>
                    <option value="promo_material">Promo material</option>
                  </select>
                  <input type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf" required />
                  <button
                    type="submit"
                    className="rounded bg-teal-500 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-600"
                  >
                    Upload
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createCampaign} className="flex flex-col gap-3">
          <input type="hidden" name="engagement_id" value={engagementId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-navy-100">Campaign name</span>
            <input type="text" name="name" required className="rounded px-3 py-2 text-navy-900" />
          </label>
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Budget (R)</span>
              <input type="number" min={0} step="0.01" name="budget" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">Start date</span>
              <input type="date" name="start_date" className="rounded px-3 py-2 text-navy-900" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="text-navy-100">End date</span>
              <input type="date" name="end_date" className="rounded px-3 py-2 text-navy-900" />
            </label>
          </div>
          <button
            type="submit"
            className="w-fit rounded bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Create campaign
          </button>
        </form>
      </section>
    </main>
  );
}
