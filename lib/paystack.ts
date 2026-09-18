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
