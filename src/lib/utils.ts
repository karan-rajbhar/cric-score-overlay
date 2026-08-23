import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Derives a short display code from a team name: first three alphanumeric
 * characters, uppercased ("Riverside Warriors" -> "RIV").
 */
export function deriveShortName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 3).toUpperCase();
}
