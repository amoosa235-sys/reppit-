import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const role = searchParams.get("role");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // OAuth sign-in carries no role metadata the way signUp()'s
      // options.data does, so handle_new_user() defaults every brand-new
      // OAuth account to 'business'. Correct it from the role carried
      // through the redirectTo query string (see signInWithOAuthProvider)
      // - but only for an account this very callback just created, never
      // a returning user's login, which wouldn't carry a role param from
      // a role-less login-page OAuth button anyway but could in principle
      // carry a stale one if bookmarked.
      const justCreated = Date.now() - new Date(data.user.created_at).getTime() < 60_000;
      if ((role === "business" || role === "provider") && justCreated) {
        await supabase.from("users").update({ role }).eq("id", data.user.id);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could+not+confirm+your+email`);
}
