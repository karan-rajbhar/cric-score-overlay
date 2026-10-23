/**
 * The Test classic typefaces (Google Fonts through next/font, never
 * preloaded: only an overlay showing this package fetches them).
 *
 * - Libre Baskerville: titles, the honours board and the big figures (an
 *   English book face, sturdy enough for 1080p after compression).
 * - Fira Sans Condensed: names, labels and tables (a humanist condensed
 *   sans that keeps long names on one line).
 */

import { Fira_Sans_Condensed, Libre_Baskerville } from "next/font/google";
import { packageFonts } from "../shared/fonts";
import type { PackageFonts } from "../types";

const serif = Libre_Baskerville({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--tc-font-serif",
  display: "swap",
  preload: false,
});

const sans = Fira_Sans_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--tc-font-sans",
  display: "swap",
  preload: false,
});

const SERIF_FALLBACK = 'Baskerville, "Baskerville Old Face", Georgia, serif';
const SANS_FALLBACK = '"Arial Narrow", "Roboto Condensed", sans-serif';

/** Serif for display and figures, the condensed sans for text. */
export const TEST_CLASSIC_FONTS: PackageFonts = {
  ...packageFonts({ display: serif, text: sans, figures: serif }, SERIF_FALLBACK),
  text: `${sans.style.fontFamily}, ${SANS_FALLBACK}`,
};
