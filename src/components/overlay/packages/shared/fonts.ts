/**
 * A package's typography from next/font results.
 *
 * Declare the fonts in the package's own module, at module scope (the
 * next/font compiler needs `const x = Font({...})` there), with
 * `preload: false` so only overlays fetch them:
 *
 *   import { Saira } from "next/font/google";
 *   const saira = Saira({ subsets: ["latin"], display: "swap",
 *     preload: false, variable: "--my-font" });
 *   fonts: packageFonts({ display: saira }, "'Arial Narrow', sans-serif"),
 *
 * Tests have no font compiler: `vitest.setup.ts` stubs `next/font/google`
 * (every family returns an empty class and its own name as the family).
 */

import type { PackageFonts } from "../types";

/** What a next/font call returns (the parts a package uses). */
export interface NextFontResult {
  className?: string;
  /** The class that defines the font's CSS variable. */
  variable?: string;
  style: { fontFamily: string };
}

/**
 * `PackageFonts` from up to three next/font results: their variable
 * classes on the stage root, and each role's family with `fallback`
 * after it. Missing roles use the display font.
 */
export function packageFonts(
  fonts: { display: NextFontResult; text?: NextFontResult; figures?: NextFontResult },
  fallback = "sans-serif",
): PackageFonts {
  const all = [fonts.display, fonts.text, fonts.figures].filter(
    (f): f is NextFontResult => !!f,
  );
  const classes = [...new Set(all.map((f) => f.variable).filter(Boolean))];
  const family = (f: NextFontResult | undefined) =>
    `${(f ?? fonts.display).style.fontFamily}, ${fallback}`;
  return {
    ...(classes.length ? { className: classes.join(" ") } : {}),
    display: family(fonts.display),
    text: family(fonts.text),
    figures: family(fonts.figures),
  };
}
