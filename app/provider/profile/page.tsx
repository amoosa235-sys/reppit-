import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveProviderProfile } from "./actions";
import { ProviderProfileForm } from "./profile-form";

export default async function ProviderProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
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

  if (account?.role !== "provider") {
    redirect("/dashboard");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select("id, category, name, bio, province, town, photos, tier, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  let repDetails = null;
  let printerDetails = null;

  if (providerProfile) {
    if (providerProfile.category === "rep") {
      const { data } = await supabase
        .from("rep_details")
        .select("industries, regions_covered, years_experience, languages")
        .eq("provider_id", providerProfile.id)
        .maybeSingle();
      repDetails = data;
    } else if (providerProfile.category === "printer") {
      const { data } = await supabase
        .from("printer_details")
        .select("print_types, turnaround_days, equipment, max_print_size")
        .eq("provider_id", providerProfile.id)
        .maybeSingle();
      printerDetails = data;
    }
  }

  const photos: { path: string; url: string }[] = (
    (providerProfile?.photos as string[] | null) ?? []
  ).map((path) => ({
    path,
    url: supabase.storage.from("provider-photos").getPublicUrl(path).data.publicUrl,
  }));

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-navy px-6 py-12 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Your provider profile</h1>

      {providerProfile && (
        <p className="text-sm text-navy-100">
          Tier: {providerProfile.tier} · Verification: {providerProfile.verification_status} ·{" "}
          <Link href="/provider/verification" className="text-teal-300 underline">
            Submit verification documents
          </Link>
        </p>
      )}

      {params.saved && <p className="text-sm text-teal-300">Saved.</p>}
      {params.error && <p className="text-sm text-red-300">{params.error}</p>}

      <ProviderProfileForm
        action={saveProviderProfile}
        initial={{
          category: (providerProfile?.category as "rep" | "printer" | undefined) ?? "rep",
          name: providerProfile?.name ?? "",
          bio: providerProfile?.bio ?? "",
          province: providerProfile?.province ?? "",
          town: providerProfile?.town ?? "",
          photos,
          rep: repDetails
            ? {
                industries: (repDetails.industries ?? []).join(", "),
                regionsCovered: (repDetails.regions_covered ?? []).join(", "),
                yearsExperience: repDetails.years_experience?.toString() ?? "",
                languages: (repDetails.languages ?? []).join(", "),
              }
            : undefined,
          printer: printerDetails
            ? {
                printTypes: (printerDetails.print_types ?? []).join(", "),
                turnaroundDays: printerDetails.turnaround_days?.toString() ?? "",
                equipment: printerDetails.equipment ?? "",
                maxPrintSize: printerDetails.max_print_size ?? "",
              }
            : undefined,
        }}
      />
    </main>
  );
}
