import Link from "next/link";
import { login } from "./actions";
import { signInWithGoogle, signInWithApple } from "@/lib/supabase/actions";
import { Button, FormInput } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ds-canvas px-6 text-ds-ink">
      <h1 className="text-ds-display-md">Log in to Reppit</h1>

      <form action={login} className="flex w-full max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-ds-mute text-ds-caption">Email</span>
          <FormInput type="email" name="email" required />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-ds-mute text-ds-caption">Password</span>
          <FormInput type="password" name="password" required />
        </label>

        {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

        <Button type="submit" variant="primary">
          Log in
        </Button>

        <div className="flex items-center gap-3 text-ds-caption text-ds-mute">
          <span className="h-px flex-1 bg-ds-hairline" />
          or continue with
          <span className="h-px flex-1 bg-ds-hairline" />
        </div>

        {/* formNoValidate: submits the same form as the email/password
            fields above, skipping their required-field validation, since
            the OAuth actions ignore those two fields entirely. */}
        <Button type="submit" formAction={signInWithGoogle} formNoValidate variant="secondary" className="w-full">
          Continue with Google
        </Button>
        <Button type="submit" formAction={signInWithApple} formNoValidate variant="secondary" className="w-full">
          Continue with Apple
        </Button>
      </form>

      <p className="text-ds-body-sm text-ds-body">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-ds-link underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
