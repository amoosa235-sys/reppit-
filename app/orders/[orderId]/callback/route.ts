import { NextResponse, type NextRequest } from "next/server";
import { creditOrderPayment } from "@/lib/orders";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(`${origin}/orders/${orderId}?error=Missing+payment+reference`);
  }

  try {
    const result = await creditOrderPayment(reference);
    if (!result.credited && result.reason !== "already processed") {
      return NextResponse.redirect(`${origin}/orders/${orderId}?error=${encodeURIComponent(result.reason)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify payment.";
    return NextResponse.redirect(`${origin}/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/orders/${orderId}?paid=1`);
}
