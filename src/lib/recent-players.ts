/**
 * Players this device added lately, offered before anything is typed: a
 * regular is one tap away instead of a search. A convenience, so every read
 * and write survives blocked storage. Names and usernames are public anyway;
 * sign-out still clears them, as a shared phone changes hands.
 */

import type { FoundPlayer } from "./player-search";

const KEY = "cric-recent-players";
/** Kept on the device; each box shows fewer. */
const KEPT = 12;

export type RecentPlayer = Pick<FoundPlayer, "id" | "name" | "username">;

export function recentPlayers(): RecentPlayer[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (p): p is RecentPlayer =>
        typeof p?.id === "string" && typeof p?.name === "string",
    );
  } catch {
    return [];
  }
}

/** The latest first, each player once. */
export function rememberPlayer(player: RecentPlayer): void {
  try {
    const rest = recentPlayers().filter((p) => p.id !== player.id);
    const { id, name, username } = player;
    localStorage.setItem(
      KEY,
      JSON.stringify([{ id, name, username }, ...rest].slice(0, KEPT)),
    );
  } catch {
    // No storage: the list just stays empty.
  }
}

export function clearRecentPlayers(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was stored.
  }
}
