import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessLoadBookingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: account } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (account?.role !== "business") {
    redirect("/dashboard");
  }

  const { data: bookings } = await supabase
    .from("load_bookings")
    .select("id, quantity, tokens_spent, booked_at, consolidated_loads(destination_region, departure_date, status)")
    .eq("booked_by_user_id", user.id)
    .order("booked_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-ds-canvas px-6 py-12 text-ds-ink">
      <h1 className="text-ds-display-md">Your load bookings</h1>

      {!bookings || bookings.length === 0 ? (
        <p className="text-ds-body text-ds-body-md">
          You haven&apos;t booked a load yet. <Link href="/loads" className="text-ds-link underline">Browse loads</Link>.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((b) => {
            const load = b.consolidated_loads as unknown as {
              destination_region: string;
              departure_date: string;
              status: string;
            } | null;
            return (
              <li key={b.id} className="rounded-ds-sm border border-ds-hairline p-ds-md text-ds-body-sm text-ds-ink">
                <p className="font-medium">{load?.destination_region}</p>
                <p className="text-ds-caption text-ds-mute">
                  Quantity {b.quantity} · departs {load?.departure_date} · {load?.status} · {b.tokens_spent} tokens
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/dashboard" className="text-ds-body-sm text-ds-link underline">
        Back to dashboard
      </Link>
    </main>
  );
}
