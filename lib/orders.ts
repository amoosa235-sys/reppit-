import { createServiceClient } from "@/lib/supabase/service";
import { verifyTransaction } from "@/lib/paystack";

type CreditResult = { credited: boolean; reason: string };

/**
 * Verifies a Paystack reference and marks the order paid. Safe to call
 * more than once for the same reference (redirect callback + webhook) -
 * record_order_payment is idempotent on orders.paystack_reference only
 * ever being set once.
 */
export async function creditOrderPayment(reference: string): Promise<CreditResult> {
  const verification = await verifyTransaction(reference);

  if (verification.status !== "success") {
    return { credited: false, reason: `Payment ${verification.status}` };
  }

  const metadata = verification.metadata ?? {};
  const orderId = String(metadata.order_id ?? "");

  if (!orderId) {
    return { credited: false, reason: "Missing order metadata." };
  }

  const supabase = createServiceClient();

  const { data: order } = await supabase.from("orders").select("id, price_total").eq("id", orderId).single();

  if (!order || order.price_total == null) {
    return { credited: false, reason: "Order not found." };
  }

  const expectedCents = Math.round(Number(order.price_total) * 100);
  if (expectedCents !== verification.amount) {
    return { credited: false, reason: "Payment amount does not match the order total." };
  }

  const { data: wasNew, error } = await supabase.rpc("record_order_payment", {
    p_reference: reference,
    p_order_id: orderId,
    p_amount: order.price_total,
  });

  if (error) {
    return { credited: false, reason: error.message };
  }

  return { credited: Boolean(wasNew), reason: wasNew ? "ok" : "already processed" };
}
