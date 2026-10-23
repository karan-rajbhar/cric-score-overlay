/**
 * Summer bash type: Unbounded (a wide, heavy, rounded display face: the
 * loud, playful headline and score figures) and Archivo (a grotesque with
 * a width axis: condensed for names that must fit, expanded black for
 * labels and table figures). Google Fonts through `next/font`, not
 * preloaded: only an overlay showing this package fetches them.
 */

import "./font-loader-shim";
import { Archivo, Unbounded } from "next/font/google";

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

export const SUMMER_BASH_FONTS = {
  className: [display.variable, text.variable].filter(Boolean).join(" "),
  display: "var(--sb-font-display), 'Arial Black', system-ui, sans-serif",
  text: "var(--sb-font-text), 'Arial Narrow', system-ui, sans-serif",
  figures: "var(--sb-font-display), 'Arial Black', system-ui, sans-serif",
};
