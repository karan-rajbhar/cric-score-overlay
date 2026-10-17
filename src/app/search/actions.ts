"use server";

import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";

export interface GlobalSearchResult {
  matches: Array<{
    id: string;
    title: string;
    status: string;
    venue: string | null;
  }>;
  teams: Array<{ id: string; name: string; short_name: string | null }>;
  players: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    username: string | null;
  }>;
  clubs: Array<{ id: string; name: string; location: string | null }>;
  tournaments: Array<{ id: string; name: string; status: string | null }>;
}

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
      prefixSearch(db, "matches", q, "id, title, status, venue", 5),
      prefixSearch(db, "teams", q, "id, name, short_name", 5),
      prefixSearch(db, "users", q, "id, full_name, avatar_url, username", 5),
      prefixSearch(db, "clubs", q, "id, name, location", 5),
      prefixSearch(db, "tournaments", q, "id, name, status", 5),
    ]);

  return {
    matches: matchesRes.data as GlobalSearchResult["matches"],
    teams: teamsRes.data as GlobalSearchResult["teams"],
    players: playersRes.data as GlobalSearchResult["players"],
    clubs: clubsRes.data as GlobalSearchResult["clubs"],
    tournaments: tournamentsRes.data as GlobalSearchResult["tournaments"],
  };
}
