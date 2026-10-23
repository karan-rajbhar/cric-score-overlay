/**
 * Summer bash type: Unbounded (a wide, heavy, rounded display face: the
 * loud, playful headlines and score figures) and Archivo (a grotesque with
 * a width axis: condensed for names that must fit, expanded black for
 * labels). Google Fonts through `next/font`, not preloaded: only an
 * overlay showing this package fetches them.
 */

import { Archivo, Unbounded } from "next/font/google";
import { packageFonts } from "../shared";

const display = Unbounded({
  subsets: ["latin"],
  variable: "--sb-font-display",
  display: "swap",
  preload: false,
});

const text = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  variable: "--sb-font-text",
  display: "swap",
  preload: false,
});

export const SUMMER_BASH_FONTS = packageFonts(
  { display, text, figures: display },
  "'Arial Black', system-ui, sans-serif",
);
