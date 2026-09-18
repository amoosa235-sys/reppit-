import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reppit",
  description: "Reppit connects businesses with sales reps and poster/signage printers across South Africa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
