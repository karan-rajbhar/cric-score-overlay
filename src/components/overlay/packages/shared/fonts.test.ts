import { Saira, Barlow_Condensed } from "next/font/google";
import { describe, expect, it } from "vitest";
import { packageFonts, type NextFontResult } from "./fonts";

const font = (family: string, variable: string): NextFontResult => ({
  className: `c-${variable}`,
  variable,
  style: { fontFamily: `'${family}', '${family} Fallback'` },
});

describe("packageFonts", () => {
  it("puts every variable class on the root and a family per role", () => {
    const f = packageFonts(
      { display: font("Saira", "v-saira"), figures: font("Outfit", "v-outfit") },
      "sans-serif",
    );
    expect(f.className).toBe("v-saira v-outfit");
    expect(f.display).toBe("'Saira', 'Saira Fallback', sans-serif");
    // Text falls back to the display font.
    expect(f.text).toBe(f.display);
    expect(f.figures).toBe("'Outfit', 'Outfit Fallback', sans-serif");
  });

  it("works with the test stub of next/font (no font compiler in tests)", () => {
    const saira = Saira({ subsets: ["latin"], preload: false });
    const barlow = Barlow_Condensed({ subsets: ["latin"], weight: "700", preload: false });
    expect(saira.style.fontFamily).toBe("'Saira'");
    const f = packageFonts({ display: barlow, text: saira });
    expect(f.className).toBeUndefined();
    expect(f.display).toBe("'Barlow Condensed', sans-serif");
    expect(f.text).toBe("'Saira', sans-serif");
  });
});
