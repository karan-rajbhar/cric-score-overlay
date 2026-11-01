"use client";

import { useCallback, useEffect, useState } from "react";
import { lookUpPlayers } from "~/lib/player-lookup";
import {
  sameNamePlayer,
  type FoundPlayer,
  type PlayerSearchResult,
} from "~/lib/player-search";

export type PlayerSearchStatus = "idle" | "searching" | "done" | "failed";

export interface PlayerSearchState {
  status: PlayerSearchStatus;
  players: FoundPlayer[];
  more: boolean;
  retry: () => void;
}

const SEARCH_DELAY_MS = 300;

/**
 * Searches existing players for `query` (debounced; "" searches nothing)
 * and says where that stands, because "still looking" and "could not look"
 * must not read as "nobody has that name": that is how a scorer ends up
 * adding someone who already exists.
 */
export function usePlayerSearch(
  query: string,
  search: (query: string) => Promise<PlayerSearchResult> = lookUpPlayers,
): PlayerSearchState {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<{
    key: string;
    result: PlayerSearchResult | null;
  } | null>(null);
  const key = `${attempt}:${query}`;

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      search(query).then(
        (result) => {
          if (!cancelled) setAnswer({ key, result });
        },
        () => {
          if (!cancelled) setAnswer({ key, result: null });
        },
      );
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, query, search]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!query) return { status: "idle", players: [], more: false, retry };
  if (answer?.key !== key) {
    return { status: "searching", players: [], more: false, retry };
  }
  if (!answer.result) {
    return { status: "failed", players: [], more: false, retry };
  }
  return { status: "done", ...answer.result, retry };
}

/**
 * A second person of exactly the same name splits a player's statistics if
 * they are the same person, so adding one takes a second tap. `allow()`
 * answers whether to go ahead; the first time it asks instead (`asking`,
 * with `twin` to show who is already there).
 */
export function useSameNameCheck(
  query: string,
  players: readonly FoundPlayer[],
) {
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const twin = sameNamePlayer(query, players);
  const asking = twin !== null && askedFor === query;
  const allow = () => {
    if (!twin || asking) return true;
    setAskedFor(query);
    return false;
  };
  return { twin, asking, allow };
}
