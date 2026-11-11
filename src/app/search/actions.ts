"use server";

import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";

export interface GlobalSearchResult {
  matches: Array<{
    id: string;
    title: string;
    status: string;
    venue: string | null;
    scheduled_at: string | null;
  }>;
  teams: Array<{
    id: string;
    name: string;
    short_name: string | null;
    logo_url?: string | null;
  }>;
  players: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
  }>;
  clubs: Array<{
    id: string;
    name: string;
    short_name?: string | null;
    location: string | null;
    logo_url?: string | null;
  }>;
  tournaments: Array<{ id: string; name: string; status: string | null }>;
  /** Groups with more matches than shown (N13): the page links to them. */
  more?: Partial<Record<"matches" | "teams" | "players" | "clubs" | "tournaments", boolean>>;
}

/** Shown per group; one more is read to know whether there are others. */
const SHOWN = 5;

/**
 * Global search across 5 entities, the single entry point for the header
 * search and the /search page. Each collection is one indexed word-prefix
 * query (`search_prefixes`, see lib/firebase/search.ts) limited to 5, so a
 * search reads at most 25 documents instead of scanning every collection.
 */
export async function globalSearch(
  query: string,
): Promise<GlobalSearchResult & { error?: string }> {
  const q = query.trim();
  if (q.length < 2) {
    return { matches: [], teams: [], players: [], clubs: [], tournaments: [] };
  }

  const db = await createServerClient();
  const [matchesRes, teamsRes, playersRes, clubsRes, tournamentsRes] =
    await Promise.all([
      prefixSearch(db, "matches", q, "id, title, status, venue, scheduled_at", SHOWN + 1),
      prefixSearch(db, "teams", q, "id, name, short_name, logo_url", SHOWN + 1),
      prefixSearch(db, "users", q, "id, full_name, avatar_url, username", SHOWN + 1),
      prefixSearch(db, "clubs", q, "id, name, short_name, location, logo_url", SHOWN + 1),
      prefixSearch(db, "tournaments", q, "id, name, status", SHOWN + 1),
    ]);
  const cut = <T,>(rows: unknown) => ((rows ?? []) as T[]).slice(0, SHOWN);
  const over = (rows: unknown) => ((rows ?? []) as unknown[]).length > SHOWN;

  return {
    matches: cut<GlobalSearchResult["matches"][number]>(matchesRes.data),
    teams: cut<GlobalSearchResult["teams"][number]>(teamsRes.data),
    players: cut<GlobalSearchResult["players"][number]>(playersRes.data),
    clubs: cut<GlobalSearchResult["clubs"][number]>(clubsRes.data),
    tournaments: cut<GlobalSearchResult["tournaments"][number]>(
      tournamentsRes.data,
    ),
    more: {
      matches: over(matchesRes.data),
      teams: over(teamsRes.data),
      players: over(playersRes.data),
      clubs: over(clubsRes.data),
      tournaments: over(tournamentsRes.data),
    },
  };
}
