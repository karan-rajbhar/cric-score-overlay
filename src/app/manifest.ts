import type { MetadataRoute } from "next";

// Colours match the light theme in src/styles/globals.css (--background, and
// the theme colour in src/app/layout.tsx): the splash screen of the installed
// app is this background with the icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CricScore",
    short_name: "CricScore",
    description:
      "Ball-by-ball cricket scoring, live scorecards and club tournaments.",
    // `id` keeps the identity of apps installed when start_url was "/".
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#fafafd",
    theme_color: "#fafafd",
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
