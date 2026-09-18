import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/supabase/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy px-6 text-center text-white">
      <h1 className="text-2xl font-bold text-teal-300">Welcome back</h1>
      <p className="text-navy-100">
        Signed in as {user.email} · role: {profile?.role ?? "unknown"}
      </p>
      {profile?.role === "provider" && (
        <div className="flex gap-4">
          <Link
            href="/provider/profile"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Manage your provider profile
          </Link>
          <Link
            href="/provider/verification"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Verification
          </Link>
          <Link
            href="/provider/unlocks"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Businesses that unlocked you
          </Link>
          <Link
            href="/provider/subscription"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Annual subscription
          </Link>
          <Link
            href="/orders"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Orders
          </Link>
          <Link
            href="/provider/hubs"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Hubs
          </Link>
        </div>
      )}
      {profile?.role === "business" && (
        <div className="flex gap-4">
          <Link
            href="/business/profile"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Business profile
          </Link>
          <Link
            href="/browse"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Browse providers
          </Link>
          <Link
            href="/catalogues"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Browse catalogues
          </Link>
          <Link
            href="/loads"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Browse loads
          </Link>
          <Link
            href="/business/tokens"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Buy tokens
          </Link>
          <Link
            href="/business/unlocks"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Your unlocks
          </Link>
          <Link
            href="/business/catalogues"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Your catalogues
          </Link>
          <Link
            href="/orders"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Orders
          </Link>
          <Link
            href="/business/load-bookings"
            className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
          >
            Load bookings
          </Link>
          <Link
            href="/business/enterprise"
            className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
          >
            Enterprise
          </Link>
        </div>
      )}
      {profile?.role === "admin" && (
        <Link
          href="/admin/verifications"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Review pending verifications
        </Link>
      )}
      <form action={signOut}>
        <button
          type="submit"
          className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
