import type { OverlayTheme } from "./types";

/** Flat accent colour per overlay theme (matches the scorebug palettes in theme-styles). */
export const THEME_ACCENT: Record<OverlayTheme, string> = {
  starsports: "#f59e0b",
  sonysports: "#e11d48",
  foxcricket: "#a3e635",
  skysports: "#ef4444",
  thehundred: "#ec4899",
  apex: "#f59e0b",
  volt: "#10b981",
  agni: "#f97316",
  dharma: "#f59e0b",
  thunder: "#60a5fa",
  nakshatra: "#c084fc",
  broadcast: "#eab308",
  emerald: "#10b981",
  dark: "#ffffff",
  minimal: "#e4e4e7",
  custom: "var(--overlay-custom-accent, #f59e0b)",
};
