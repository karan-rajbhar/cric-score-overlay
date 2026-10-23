/**
 * The Hundred-ball type: a blocky monospaced face for names, labels and
 * figures (set tight, in caps, like stacked headline blocks), a stencil
 * face for the giant sting words and numerals, and a plain grotesque for
 * sentences. Google Fonts, never preloaded: only overlays fetch them.
 */

import { Archivo, Big_Shoulders_Stencil, Martian_Mono } from "next/font/google";
import { packageFonts } from "../shared";

const mono = Martian_Mono({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-hb-mono",
  display: "swap",
  preload: false,
});

const stencil = Big_Shoulders_Stencil({
  subsets: ["latin"],
  variable: "--font-hb-stencil",
  display: "swap",
  preload: false,
  // next/font has no fallback metrics for it (only sting words use it).
  adjustFontFallback: false,
});

const text = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-hb-text",
  display: "swap",
  preload: false,
});

/** The stencil face's family (stings and break cards use it directly). */
export const STENCIL_FAMILY = stencil.style.fontFamily;

export const HUNDRED_FONTS = packageFonts(
  { display: mono, text, figures: mono },
  "ui-monospace, monospace",
);
