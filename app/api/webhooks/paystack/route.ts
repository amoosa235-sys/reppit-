import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { creditTokenPurchase } from "@/lib/tokens";

export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  if (!secretKey || !signature) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success" && event.data?.reference) {
    try {
      await creditTokenPurchase(event.data.reference);
    } catch (err) {
      // Signal failure so Paystack retries the webhook - swallowing this
      // would silently drop a payment if our side (or Paystack's verify
      // endpoint) had a transient issue.
      console.error("Paystack webhook: failed to credit purchase", err);
      return NextResponse.json({ error: "Could not process event" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
