import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/supabase/actions";
import { Button, LinkButton } from "@/components/ui";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ds-canvas px-6 text-center text-ds-ink">
      <h1 className="text-ds-display-md">Welcome back</h1>
      <p className="text-ds-body text-ds-body-md">
        Signed in as {user.email} · role: {profile?.role ?? "unknown"}
      </p>
      {profile?.role === "provider" && (
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/provider/profile" variant="secondary">
            Manage your provider profile
          </LinkButton>
          <LinkButton href="/provider/verification" variant="secondary">
            Verification
          </LinkButton>
          <LinkButton href="/provider/unlocks" variant="secondary">
            Businesses that unlocked you
          </LinkButton>
          <LinkButton href="/provider/subscription" variant="secondary">
            Annual subscription
          </LinkButton>
          <LinkButton href="/orders" variant="secondary">
            Orders
          </LinkButton>
          <LinkButton href="/provider/hubs" variant="secondary">
            Hubs
          </LinkButton>
          <LinkButton href="/engagements" variant="secondary">
            Engagements
          </LinkButton>
        </div>
      )}
      {profile?.role === "business" && (
        <div className="flex flex-wrap justify-center gap-3">
          <LinkButton href="/business/profile" variant="secondary">
            Business profile
          </LinkButton>
          <LinkButton href="/browse" variant="secondary">
            Browse providers
          </LinkButton>
          <LinkButton href="/catalogues" variant="secondary">
            Browse catalogues
          </LinkButton>
          <LinkButton href="/loads" variant="secondary">
            Browse loads
          </LinkButton>
          <LinkButton href="/business/tokens" variant="secondary">
            Buy tokens
          </LinkButton>
          <LinkButton href="/business/unlocks" variant="secondary">
            Your unlocks
          </LinkButton>
          <LinkButton href="/business/catalogues" variant="secondary">
            Your catalogues
          </LinkButton>
          <LinkButton href="/orders" variant="secondary">
            Orders
          </LinkButton>
          <LinkButton href="/business/load-bookings" variant="secondary">
            Load bookings
          </LinkButton>
          <LinkButton href="/business/enterprise" variant="secondary">
            Enterprise
          </LinkButton>
          <LinkButton href="/engagements" variant="secondary">
            Engagements
          </LinkButton>
        </div>
      )}
      {profile?.role === "admin" && (
        <LinkButton href="/admin/verifications" variant="secondary">
          Review pending verifications
        </LinkButton>
      )}
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </main>
  );
}
