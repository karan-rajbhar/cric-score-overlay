"use client";

import { Loader2 } from "lucide-react";
import { Button } from "~/components/ds/button";
import type { PlayerSearchState } from "~/lib/hooks/usePlayerSearch";
import {
  foundPlayerHint,
  typedHandle,
  type FoundPlayer,
} from "~/lib/player-search";

/**
 * One line under a player search saying where it stands: looking, found
 * nobody, could not look (with Try again), or found too many to show. A
 * failed search says so instead of looking like an empty one, so nobody
 * adds a duplicate believing the player does not exist.
 */
export function PlayerSearchNote({
  search,
  query,
  listed,
}: {
  search: Pick<PlayerSearchState, "status" | "more" | "retry">;
  /** What was typed, as typed. */
  query: string;
  /** People this box lists for the query, wherever they came from. */
  listed: number;
}) {
  const handle = typedHandle(query);
  return (
    <div role="status" className="px-1 text-xs text-muted-foreground empty:hidden">
      {search.status === "searching" && (
        <span className="flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Looking for “{query}” on CricScore
        </span>
      )}
      {search.status === "failed" && (
        <span className="flex flex-wrap items-center gap-x-2 text-warning">
          Could not check whether “{query}” is already on CricScore.
          <Button
            type="button"
            variant="link"
            size="sm"
            className="min-h-11"
            onClick={search.retry}
          >
            Try again
          </Button>
        </span>
      )}
      {search.status === "done" &&
        listed === 0 &&
        (handle === null
          ? `Nobody on CricScore matches “${query}”.`
          : `Nobody has the username @${handle}.`)}
      {search.status === "done" &&
        listed > 0 &&
        search.more &&
        "More players match. Type more of the name, or their @username."}
    </div>
  );
}

/**
 * Shown when adding a second person of a name someone already has, or of
 * one that sounds like it (`similar`). A similar player who cannot be
 * picked here (`twin.unavailable`) is named with why, and where the fix
 * for a mix-up is, instead of a new player.
 */
export function SameNameNote({
  twin,
  similar = false,
}: {
  twin: FoundPlayer;
  similar?: boolean;
}) {
  if (twin.unavailable) {
    return (
      <p role="alert" className="px-1 text-xs text-warning">
        {twin.name} is in this squad ({twin.unavailable.toLowerCase()}). If the
        names were mixed up, use Fix a mistake on the ball where it started.
        Add a new player only if this is a different person.
      </p>
    );
  }
  return (
    <p role="alert" className="px-1 text-xs text-warning">
      {similar
        ? `${twin.name} is already on CricScore (${foundPlayerHint(twin)}). Is this them? Pick them instead, or add a new player only if this is a different person.`
        : `${twin.name} is already on CricScore (${foundPlayerHint(twin)}). Add a second one only if this is a different person.`}
    </p>
  );
}
