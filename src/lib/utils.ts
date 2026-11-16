import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derives a short display code from a team name: first three alphanumeric
 * characters, uppercased ("Riverside Warriors" -> "RIV").
 */
export function deriveShortName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 3).toUpperCase();
}

/** "Rahul Sharma" → "RS" (two letters), "Rahul" → "RA" or "R": a name's initials. */
export function initialsOf(name: string, letters: 1 | 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (letters === 1 || words.length === 1) {
    return (words[0] ?? "?").slice(0, letters).toUpperCase();
  }
  return `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
}
