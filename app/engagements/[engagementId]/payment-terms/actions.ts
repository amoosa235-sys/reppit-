"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTransferRecipient } from "@/lib/paystack";

const PAYMENT_TYPES = new Set(["commission", "retainer"]);
const FREQUENCIES = new Set(["per_order", "weekly", "monthly"]);

function toNumberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function setPaymentTerms(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const paymentType = String(formData.get("payment_type") ?? "");
  const frequency = String(formData.get("frequency") ?? "monthly");

  if (!PAYMENT_TYPES.has(paymentType) || !FREQUENCIES.has(frequency)) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent("Invalid payment terms."));
  }

  const { error } = await supabase.rpc("set_engagement_payment_terms", {
    p_engagement_id: engagementId,
    p_payment_type: paymentType,
    p_commission_pct: toNumberOrNull(formData.get("commission_pct")),
    p_retainer_amount: toNumberOrNull(formData.get("retainer_amount")),
    p_frequency: frequency,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}

export async function setPaymentRecipient(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const engagementId = String(formData.get("engagement_id") ?? "");
  const accountName = String(formData.get("account_name") ?? "").trim();
  const accountNumber = String(formData.get("account_number") ?? "").trim();
  const bankCode = String(formData.get("bank_code") ?? "").trim();

  if (!accountName || !accountNumber || !bankCode) {
    redirect(
      `/engagements/${engagementId}?error=` +
        encodeURIComponent("Enter the account holder name, account number, and bank code."),
    );
  }

  let recipientCode: string;
  try {
    const recipient = await createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode,
    });
    recipientCode = recipient.recipient_code;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not register the payout recipient.";
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(message));
  }

  const { error } = await supabase.rpc("set_engagement_payment_recipient", {
    p_engagement_id: engagementId,
    p_recipient_code: recipientCode,
  });

  if (error) {
    redirect(`/engagements/${engagementId}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath(`/engagements/${engagementId}`);
  redirect(`/engagements/${engagementId}?saved=1`);
}
