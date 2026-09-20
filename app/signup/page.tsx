import Link from "next/link";
import { signup } from "./actions";
import { signInWithGoogle, signInWithApple } from "@/lib/supabase/actions";
import { Button, FormInput } from "@/components/ui";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; "check-email"?: string }>;
}) {
  const params = await searchParams;

  if (params["check-email"]) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ds-canvas px-6 text-center text-ds-ink">
        <h1 className="text-ds-display-md">Check your email</h1>
        <p className="max-w-md text-ds-body text-ds-body-md">
          We sent you a confirmation link. Follow it to activate your account, then log in.
        </p>
        <Link href="/login" className="text-ds-link underline">
          Back to log in
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ds-canvas px-6 text-ds-ink">
      <h1 className="text-ds-display-md">Create your Reppit account</h1>

      <form action={signup} className="flex w-full max-w-sm flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-ds-mute text-ds-caption">I am a...</legend>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="business" defaultChecked required />
            Business looking for reps/printers
          </label>
          <label className="flex items-center gap-2 text-ds-body text-ds-body-sm">
            <input type="radio" name="role" value="provider" required />
            Sales rep or printer
          </label>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-ds-mute text-ds-caption">Email</span>
          <FormInput type="email" name="email" required />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-ds-mute text-ds-caption">Password</span>
          <FormInput type="password" name="password" required minLength={6} />
        </label>

        {params.error && <p className="text-ds-body-sm text-red-400">{params.error}</p>}

        <Button type="submit" variant="primary">
          Sign up
        </Button>

        <div className="flex items-center gap-3 text-ds-caption text-ds-mute">
          <span className="h-px flex-1 bg-ds-hairline" />
          or continue with
          <span className="h-px flex-1 bg-ds-hairline" />
        </div>

        {/* formNoValidate: these buttons submit the same form as the
            email/password fields above (so the selected role radio comes
            along), but must skip HTML5 required-field validation on
            email/password since the OAuth actions ignore them. */}
        <Button type="submit" formAction={signInWithGoogle} formNoValidate variant="secondary" className="w-full">
          Continue with Google
        </Button>
        <Button type="submit" formAction={signInWithApple} formNoValidate variant="secondary" className="w-full">
          Continue with Apple
        </Button>
      </form>

      <p className="text-ds-body-sm text-ds-body">
        Already have an account?{" "}
        <Link href="/login" className="text-ds-link underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
