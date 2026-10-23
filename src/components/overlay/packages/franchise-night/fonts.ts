/**
 * Franchise night's typeface: Saira, a variable family whose width axis
 * gives the condensed caps of names and stings and the semi-condensed
 * figures from one file per style. Self-hosted by next/font and fetched
 * only by overlays (`preload: false`).
 */

import { Saira } from "next/font/google";

export const saira = Saira({
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--fn-font",
});
