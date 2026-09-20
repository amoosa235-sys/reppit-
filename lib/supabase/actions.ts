"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// Shared by the login and signup pages - signInWithOAuth() handles both
// signup and login transparently (Supabase creates the account on first
// OAuth if it doesn't exist), so one helper covers both entry points and
// both providers.
//
// Unlike signUp()'s options.data, signInWithOAuth() has no way to attach
// our own app metadata (role) to the account it creates - the identity
// provider is the only source of raw_user_meta_data here. The role is
// instead carried through `redirectTo`'s query string and picked up by
// app/auth/callback/route.ts after the OAuth round trip.
//
// This isn't itself exported as a form action: a <button formAction={fn}>
// needs a distinct function per button (Next.js rewrites that button's own
// `name` attribute to route the submit to the right server action, so a
// shared action read via formData.get("provider") collides with that and
// throws a hydration mismatch - `name="provider"` on the client, some
// internal action-id string on the server). Two thin wrappers below give
// each button its own action instead.
async function startOAuthSignIn(provider: "google" | "apple", formData: FormData) {
  const role = String(formData.get("role") ?? "");

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const redirectTo =
    role === "business" || role === "provider"
      ? `${origin}/auth/callback?role=${role}`
      : `${origin}/auth/callback`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error || !data?.url) {
    redirect("/login?error=" + encodeURIComponent(error?.message ?? "Could not start sign-in."));
  }

  redirect(data.url);
}

export async function signInWithGoogle(formData: FormData) {
  await startOAuthSignIn("google", formData);
}

export async function signInWithApple(formData: FormData) {
  await startOAuthSignIn("apple", formData);
}
