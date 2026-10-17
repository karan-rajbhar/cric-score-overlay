import type { MetadataRoute } from "next";

// Colours match the light-theme tokens in src/styles/globals.css (--background, --board).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CricScore",
    short_name: "CricScore",
    description:
      "Ball-by-ball cricket scoring, live scorecards and club tournaments.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f6",
    theme_color: "#113227",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
