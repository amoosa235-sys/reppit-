import type { MetadataRoute } from "next";

// Uses the opaque "white background" icon variants (not the transparent
// ones) - Android/PWA install icons render badly with transparency, same
// reasoning as Apple's touch icon requirement.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reppit",
    short_name: "Reppit",
    description:
      "Reppit connects businesses with sales reps and poster/signage printers across South Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b2545",
    theme_color: "#0b2545",
    icons: [
      {
        src: "/brand/icon-white-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/icon-white-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
