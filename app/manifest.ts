import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spliit — split expenses with friends",
    short_name: "Spliit",
    description:
      "Split trip and group expenses in any currency, scan receipts, see who owes what, and settle up in a tap.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0710",
    theme_color: "#0b0710",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
