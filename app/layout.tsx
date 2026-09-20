import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Only the design-system components (components/ui/*) reference
// --font-inter, via the ds-sans token in globals.css - this doesn't
// change the rest of the app's font, which still falls through to
// Tailwind's own default font-sans stack.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Reppit",
  description: "Reppit connects businesses with sales reps and poster/signage printers across South Africa.",
};

export const viewport: Viewport = {
  themeColor: "#0b2545",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
