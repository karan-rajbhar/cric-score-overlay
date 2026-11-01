/**
 * The browser's call to `GET /api/players/search`: a stable route, not a
 * server action, because the scoring screen stays open across deploys and
 * an old build's server action ids stop working. A search that gets no
 * answer rejects (`usePlayerSearch` says so): it must never look like
 * "nobody has that name", or the scorer adds a duplicate.
 */

import type { PlayerSearchResult } from "./player-search";

/** A phone at a ground gets this long before the scorer is told. */
export const PLAYER_LOOKUP_TIMEOUT_MS = 6_000;

export async function lookUpPlayers(
  query: string,
  /** The club being added to: its members come first. */
  { clubId }: { clubId?: string | null } = {},
): Promise<PlayerSearchResult> {
  const params = new URLSearchParams({ q: query });
  if (clubId) params.set("club", clubId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLAYER_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/players/search?${params}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Player search answered ${res.status}`);
    return (await res.json()) as PlayerSearchResult;
  } finally {
    clearTimeout(timer);
  }
}
