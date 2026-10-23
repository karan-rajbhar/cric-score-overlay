/**
 * World event's typeface: Figtree (OFL), a geometric sans with a black
 * weight, set in caps for names and headings the way global-event feeds
 * set theirs, and tabular figures for scores. Not preloaded: only an
 * overlay showing this package fetches it.
 *
 * Loaded on first use by `use-fonts.ts` (see there for why).
 */

import { Figtree } from "next/font/google";

const figtree = Figtree({
  subsets: ["latin"],
  weight: "variable",
  variable: "--we-font",
  display: "swap",
  preload: false,
});

/** Defines `--we-font` (the family); put it on the element's root. */
export const WORLD_EVENT_FONT_CLASS = figtree.variable;
