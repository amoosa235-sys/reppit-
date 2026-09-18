import Link from "next/link";
import { signup } from "./actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; "check-email"?: string }>;
}) {
  const params = await searchParams;

  if (params["check-email"]) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy px-6 text-center text-white">
        <h1 className="text-2xl font-bold text-teal-300">Check your email</h1>
        <p className="max-w-md text-navy-100">
          We sent you a confirmation link. Follow it to activate your account, then log in.
        </p>
        <Link href="/login" className="text-teal-300 underline">
          Back to log in
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Create your Reppit account</h1>

      <form action={signup} className="flex w-full max-w-sm flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-navy-100">I am a...</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="business" defaultChecked required />
            Business looking for reps/printers
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="provider" required />
            Sales rep or printer
          </label>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Email</span>
          <input
            type="email"
            name="email"
            required
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-navy-100">Password</span>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        {params.error && <p className="text-sm text-red-300">{params.error}</p>}

        <button
          type="submit"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Sign up
        </button>
      </form>

      <p className="text-sm text-navy-100">
        Already have an account?{" "}
        <Link href="/login" className="text-teal-300 underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
