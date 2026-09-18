import { NextResponse, type NextRequest } from "next/server";
import { creditTokenPurchase } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(`${origin}/business/tokens?error=Missing+payment+reference`);
  }

  try {
    const result = await creditTokenPurchase(reference);
    if (!result.credited && result.reason !== "already processed") {
      return NextResponse.redirect(`${origin}/business/tokens?error=${encodeURIComponent(result.reason)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify payment.";
    return NextResponse.redirect(`${origin}/business/tokens?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/business/tokens?purchased=1`);
}
