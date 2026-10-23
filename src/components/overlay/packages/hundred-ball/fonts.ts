/**
 * The Hundred-ball type: a blocky monospaced face for names, labels and
 * figures (set tight, in caps, like stacked headline blocks), a stencil
 * face for the giant sting words and numerals, and a plain grotesque for
 * sentences. Google Fonts, never preloaded: only overlays fetch them.
 */

import { Archivo, Big_Shoulders_Stencil, Martian_Mono } from "next/font/google";
import type { PackageFonts } from "../types";

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

export const HUNDRED_FONTS: PackageFonts = {
  className: [mono.variable, stencil.variable, text.variable].join(" "),
  display: "var(--font-hb-mono), ui-monospace, monospace",
  text: "var(--font-hb-text), system-ui, sans-serif",
  figures: "var(--font-hb-mono), ui-monospace, monospace",
};
