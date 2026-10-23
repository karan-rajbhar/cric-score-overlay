/**
 * World event's typeface: Figtree (OFL), a geometric sans with a black
 * weight, set in caps for names and headings the way global-event feeds
 * set theirs, with tabular figures for scores. Self-hosted by next/font
 * and fetched only by overlays (`preload: false`).
 */

import { Figtree } from "next/font/google";

export const figtree = Figtree({
  subsets: ["latin"],
  weight: "variable",
  variable: "--we-font",
  display: "swap",
  preload: false,
});
