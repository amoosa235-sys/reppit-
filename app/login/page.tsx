import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-white">
      <h1 className="text-2xl font-bold text-teal-300">Log in to Reppit</h1>

      <form action={login} className="flex w-full max-w-sm flex-col gap-4">
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
            className="rounded px-3 py-2 text-navy-900"
          />
        </label>

        {params.error && <p className="text-sm text-red-300">{params.error}</p>}

        <button
          type="submit"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Log in
        </button>
      </form>

      <p className="text-sm text-navy-100">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-teal-300 underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
