const PAYSTACK_BASE_URL = "https://api.paystack.co";

function requireSecretKey(): string {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  }
  return secretKey;
}

// Paystack always responds with JSON, but a network/proxy failure between
// us and them can return an HTML or plain-text error page instead - parse
// defensively so that shows up as a normal Error, not an unhandled
// SyntaxError from res.json().
async function parseResponse(res: Response): Promise<{ status: boolean; message?: string; data?: unknown }> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Paystack returned a non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

type InitializeParams = {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  // Attaches the charge to a Paystack Plan - on success Paystack turns
  // this into a recurring subscription that bills the same
  // authorization automatically going forward, no further action needed
  // on our side beyond handling the renewal webhooks.
  plan?: string;
};

type InitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initializeTransaction(params: InitializeParams): Promise<InitializeResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      plan: params.plan,
    }),
  });

  const json = await parseResponse(res);
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Could not start Paystack transaction.");
  }

  return json.data as InitializeResult;
}

export type VerifyResult = {
  status: "success" | "failed" | "abandoned" | string;
  reference: string;
  amount: number;
  metadata: Record<string, unknown> | null;
  // Present on a subscription-linked charge (initial or renewal) -
  // renewal charges typically don't carry forward our own metadata, so
  // matching a renewal to the right enterprise subscription falls back
  // to plan_code + customer email instead. Best-effort: exact renewal
  // webhook shapes haven't been exercised against a live Paystack
  // account, only documented behavior.
  plan_object: { plan_code: string } | null;
  customer: { email: string } | null;
};

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${requireSecretKey()}` },
  });

  const json = await parseResponse(res);
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Could not verify Paystack transaction.");
  }

  return json.data as VerifyResult;
}

type CreatePlanParams = {
  name: string;
  amountKobo: number;
  interval: "monthly";
};

export async function createPlan(params: CreatePlanParams): Promise<{ plan_code: string }> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      amount: params.amountKobo,
      interval: params.interval,
    }),
  });

  const json = await parseResponse(res);
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Could not create Paystack plan.");
  }

  return json.data as { plan_code: string };
}

type CreateTransferRecipientParams = {
  name: string;
  accountNumber: string;
  bankCode: string;
};

// South African bank account recipient ("basa"), per Paystack's documented
// recipient types for the ZA integration - not exercised against a live
// Paystack account in this pass (same sandbox network restriction noted
// throughout this codebase for every other Paystack call). Reppit never
// stores the account number/bank code itself; only the recipient_code this
// returns is persisted (engagement_payment_terms.paystack_recipient_code).
export async function createTransferRecipient(
  params: CreateTransferRecipientParams,
): Promise<{ recipient_code: string }> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "basa",
      name: params.name,
      account_number: params.accountNumber,
      bank_code: params.bankCode,
      currency: "ZAR",
    }),
  });

  const json = await parseResponse(res);
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Could not register Paystack transfer recipient.");
  }

  return json.data as { recipient_code: string };
}
