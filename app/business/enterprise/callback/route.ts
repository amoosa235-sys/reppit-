import { NextResponse, type NextRequest } from "next/server";
import { activateEnterpriseSubscription } from "@/lib/enterprise";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(`${origin}/business/enterprise?error=Missing+payment+reference`);
  }

  try {
    const result = await activateEnterpriseSubscription(reference);
    if (!result.activated && result.reason !== "already processed") {
      return NextResponse.redirect(`${origin}/business/enterprise?error=${encodeURIComponent(result.reason)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify payment.";
    return NextResponse.redirect(`${origin}/business/enterprise?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/business/enterprise?started=1`);
}
