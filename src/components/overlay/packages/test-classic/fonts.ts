/**
 * The Test classic typefaces (Google Fonts through next/font, never
 * preloaded: only an overlay showing this package fetches them).
 *
 * - Libre Baskerville: titles, the honours board and the big figures (an
 *   English book face, sturdy enough for 1080p after compression).
 * - Fira Sans Condensed: names, labels and tables (a humanist condensed
 *   sans that keeps long names on one line).
 *
 * Loaded lazily by `use-fonts.ts`, never imported statically: next/font
 * calls only work under Next's compiler, and the registry (imported by
 * many tests) must not evaluate them.
 */

import { Fira_Sans_Condensed, Libre_Baskerville } from "next/font/google";

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

/** The classes that define `--tc-font-serif` and `--tc-font-sans`. */
export const TEST_CLASSIC_FONT_CLASS = `${serif.variable} ${sans.variable}`;
