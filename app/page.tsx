import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-center text-white">
      {/* The logo's navy tones would merge into bg-navy without a light
          backing - neither provided variant (transparent, white-background)
          is a white-colored mark meant to sit directly on a dark page. */}
      <div className="rounded-2xl bg-white px-6 py-4">
        <Image
          src="/brand/logo-full-transparent-400w.png"
          alt="Reppit"
          width={400}
          height={389}
          priority
          className="h-auto w-56"
        />
      </div>
      <p className="max-w-md text-navy-100">
        Connecting businesses with sales reps and poster/signage printers across South Africa.
      </p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded border border-teal-300 px-4 py-2 font-semibold text-teal-300 hover:bg-navy-800"
        >
          Log in
        </Link>
        <Link href="/browse" className="text-teal-300 underline">
          Browse providers
        </Link>
        <Link href="/catalogues" className="text-teal-300 underline">
          Browse catalogues
        </Link>
      </div>
    </main>
  );
}
