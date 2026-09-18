"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";

const SELLER_STAGES = new Set(["in_progress", "dispatched", "delivered"]);
const BUYER_STAGES = new Set(["completed", "cancelled"]);

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function loadOrderParties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
) {
  const { data: order } = await supabase
    .from("orders")
    .select("id, stage, buyer_user_id, catalogues(business_user_id), provider_profiles(user_id)")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const catalogueOwnerId = (order.catalogues as unknown as { business_user_id: string } | null)
    ?.business_user_id;
  const providerOwnerId = (order.provider_profiles as unknown as { user_id: string } | null)?.user_id;

  return {
    stage: order.stage as string,
    buyerUserId: order.buyer_user_id as string,
    sellerUserId: catalogueOwnerId ?? providerOwnerId ?? null,
  };
}

export async function updateStage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "");
  const stage = String(formData.get("stage") ?? "");

  const parties = await loadOrderParties(supabase, orderId);
  if (!parties) {
    redirect("/orders");
  }

  const isBuyer = parties.buyerUserId === user.id;
  const isSeller = parties.sellerUserId === user.id;

  const allowed = (isSeller && SELLER_STAGES.has(stage)) || (isBuyer && BUYER_STAGES.has(stage));

  if (!allowed) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("You can't set that stage."));
  }

  const { error } = await supabase.from("orders").update({ stage }).eq("id", orderId);

  if (error) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(error.message));
  }

  await supabase.from("order_status_history").insert({ order_id: orderId, stage, changed_by: user.id });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function confirmPayment(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "");

  const parties = await loadOrderParties(supabase, orderId);
  if (!parties) {
    redirect("/orders");
  }

  if (parties.sellerUserId !== user.id) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("Only the seller can confirm payment."));
  }

  const newStage = ["pending", "payment_pending"].includes(parties.stage) ? "payment_confirmed" : parties.stage;

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_confirmed_by: user.id,
      payment_confirmed_at: new Date().toISOString(),
      stage: newStage,
    })
    .eq("id", orderId);

  if (error) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(error.message));
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    stage: newStage,
    note: "Payment confirmed (EFT)",
    changed_by: user.id,
  });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function uploadProof(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "");

  const parties = await loadOrderParties(supabase, orderId);
  if (!parties) {
    redirect("/orders");
  }

  if (parties.buyerUserId !== user.id) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("Only the buyer can upload proof of payment."));
  }

  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("Choose a file to upload."));
  }
  if (!ALLOWED_PROOF_TYPES.has(file.type)) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("Unsupported file type - use PDF, JPEG, or PNG."));
  }
  if (file.size > MAX_PROOF_BYTES) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("File too large (max 10MB)."));
  }

  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("order-proofs")
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(uploadError.message));
  }

  const { error } = await supabase
    .from("orders")
    .update({ payment_method: "eft_manual", payment_status: "pending_proof", proof_of_payment_url: path })
    .eq("id", orderId);

  if (error) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(error.message));
  }

  await supabase.from("order_status_history").insert({
    order_id: orderId,
    stage: parties.stage,
    note: "Proof of payment uploaded",
    changed_by: user.id,
  });

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function initializeOrderPayment(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "");

  const { data: order } = await supabase
    .from("orders")
    .select("id, price_total, buyer_user_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.buyer_user_id !== user.id) {
    redirect("/orders");
  }
  if (order.price_total == null) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("This order has no price set."));
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email: user.email!,
      amountKobo: Math.round(Number(order.price_total) * 100),
      callbackUrl: `${origin}/orders/${orderId}/callback`,
      metadata: { type: "order_payment", order_id: orderId },
    });
    authorizationUrl = result.authorization_url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(message));
  }

  redirect(authorizationUrl);
}

export async function sendOrderMessage(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orderId = String(formData.get("order_id") ?? "");
  const recipientId = String(formData.get("recipient_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent("Message can't be empty."));
  }

  const { error } = await supabase.from("messages").insert({
    order_id: orderId,
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    redirect(`/orders/${orderId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}
