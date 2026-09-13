import { describe, expect, it } from "vitest";
import {
  getContrastRatio,
  getRelativeLuminance,
  isWcagAANormal,
  isWcagAALarge,
  PALETTE,
} from "./design-tokens";

describe("Design Tokens & WCAG 2.1 AA Contrast Ratios", () => {
  it("calculates relative luminance correctly for black and white", () => {
    expect(getRelativeLuminance([0, 0, 0])).toBeCloseTo(0, 4);
    expect(getRelativeLuminance([255, 255, 255])).toBeCloseTo(1, 4);
  });

  it("calculates contrast ratio correctly for black and white (21:1)", () => {
    const ratio = getContrastRatio([0, 0, 0], [255, 255, 255]);
    expect(ratio).toBeCloseTo(21, 1);
    expect(isWcagAANormal(ratio)).toBe(true);
    expect(isWcagAALarge(ratio)).toBe(true);
  });

  describe("Dark Mode Surfaces & Text Contrast", () => {
    const darkBase = PALETTE.darkSurfaces.base.rgb;
    const darkSurface1 = PALETTE.darkSurfaces.surface1.rgb;
    const textPrimary = PALETTE.darkSurfaces.textPrimary.rgb;
    const textSecondary = PALETTE.darkSurfaces.textSecondary.rgb;
    const textMuted = PALETTE.darkSurfaces.textMuted.rgb;

    it("primary text meets WCAG AA (>= 4.5:1) on dark base and surface1", () => {
      const ratioBase = getContrastRatio(textPrimary, darkBase);
      const ratioSurface1 = getContrastRatio(textPrimary, darkSurface1);

      expect(ratioBase).toBeGreaterThanOrEqual(14.0);
      expect(ratioSurface1).toBeGreaterThanOrEqual(13.0);
      expect(isWcagAANormal(ratioBase)).toBe(true);
      expect(isWcagAANormal(ratioSurface1)).toBe(true);
    });

    it("secondary text meets WCAG AA (>= 4.5:1) on dark base and surface1", () => {
      const ratioBase = getContrastRatio(textSecondary, darkBase);
      const ratioSurface1 = getContrastRatio(textSecondary, darkSurface1);

      expect(ratioBase).toBeGreaterThanOrEqual(8.0);
      expect(ratioSurface1).toBeGreaterThanOrEqual(7.5);
      expect(isWcagAANormal(ratioBase)).toBe(true);
      expect(isWcagAANormal(ratioSurface1)).toBe(true);
    });

    it("muted text meets WCAG AA (>= 4.5:1) on dark base", () => {
      const ratioBase = getContrastRatio(textMuted, darkBase);
      expect(ratioBase).toBeGreaterThanOrEqual(4.5);
      expect(isWcagAANormal(ratioBase)).toBe(true);
    });
  });

  describe("Light Mode Surfaces & Text Contrast", () => {
    const lightBase = PALETTE.lightSurfaces.base.rgb;
    const lightSurface1 = PALETTE.lightSurfaces.surface1.rgb;
    const textPrimary = PALETTE.lightSurfaces.textPrimary.rgb;
    const textSecondary = PALETTE.lightSurfaces.textSecondary.rgb;
    const textMuted = PALETTE.lightSurfaces.textMuted.rgb;

    it("primary text meets WCAG AA (>= 4.5:1) on light base and surface1", () => {
      const ratioBase = getContrastRatio(textPrimary, lightBase);
      const ratioSurface1 = getContrastRatio(textPrimary, lightSurface1);

      expect(ratioBase).toBeGreaterThanOrEqual(13.0);
      expect(ratioSurface1).toBeGreaterThanOrEqual(14.0);
      expect(isWcagAANormal(ratioBase)).toBe(true);
      expect(isWcagAANormal(ratioSurface1)).toBe(true);
    });

    it("secondary text meets WCAG AA (>= 4.5:1) on light base and surface1", () => {
      const ratioBase = getContrastRatio(textSecondary, lightBase);
      const ratioSurface1 = getContrastRatio(textSecondary, lightSurface1);

      expect(ratioBase).toBeGreaterThanOrEqual(6.5);
      expect(ratioSurface1).toBeGreaterThanOrEqual(7.0);
      expect(isWcagAANormal(ratioBase)).toBe(true);
      expect(isWcagAANormal(ratioSurface1)).toBe(true);
    });

    it("muted text meets WCAG AA (>= 4.5:1) on light base", () => {
      const ratioBase = getContrastRatio(textMuted, lightBase);
      expect(ratioBase).toBeGreaterThanOrEqual(4.5);
      expect(isWcagAANormal(ratioBase)).toBe(true);
    });
  });
});
