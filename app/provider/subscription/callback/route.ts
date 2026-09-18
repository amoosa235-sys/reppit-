import { NextResponse, type NextRequest } from "next/server";
import { activateProviderSubscription } from "@/lib/subscriptions";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const reference = searchParams.get("reference");

  if (!reference) {
    return NextResponse.redirect(`${origin}/provider/subscription?error=Missing+payment+reference`);
  }

  try {
    const result = await activateProviderSubscription(reference);
    if (!result.activated && result.reason !== "already processed") {
      return NextResponse.redirect(
        `${origin}/provider/subscription?error=${encodeURIComponent(result.reason)}`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not verify payment.";
    return NextResponse.redirect(`${origin}/provider/subscription?error=${encodeURIComponent(message)}`);
  }

  return NextResponse.redirect(`${origin}/provider/subscription?subscribed=1`);
}
