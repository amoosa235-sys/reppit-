import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ds-canvas px-6 text-center text-ds-ink">
      {/* The logo's navy tones would merge into bg-ds-canvas without a light
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
      <p className="max-w-md text-ds-body text-ds-body-md">
        Connecting businesses with sales reps and poster/signage printers across South Africa.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <LinkButton href="/signup" variant="primary">
          Sign up
        </LinkButton>
        <LinkButton href="/login" variant="secondary">
          Log in
        </LinkButton>
        <Link href="/browse" className="text-ds-link text-ds-body-sm underline">
          Browse providers
        </Link>
        <Link href="/catalogues" className="text-ds-link text-ds-body-sm underline">
          Browse catalogues
        </Link>
      </div>
    </main>
  );
}
