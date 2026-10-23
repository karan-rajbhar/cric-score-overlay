/**
 * Shared, look-free pieces for broadcast packages (`packages/shared/`):
 *
 * - `layout`: the 1920x1080 canvas, title safe, score bug and lower-third anchors.
 * - `derive`: figures from the element props (the chase, balls, projections,
 *   partnership, this over's balls, batter / bowler figures, short names...).
 * - `charts` / `use-chart-data`: per-over runs, the worm, phase rates and
 *   wagon-wheel shots (series and geometry; each package draws its own).
 * - `slots`: crest and photo slots that fall back to initials.
 * - `fonts`: `PackageFonts` from next/font results.
 *
 * Everything that makes a package look like itself stays in the package.
 */

export * from "./charts";
export * from "./derive";
export * from "./fonts";
export * from "./layout";
export * from "./slots";
export * from "./use-chart-data";
