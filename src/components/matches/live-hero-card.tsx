"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { sidesInBattingOrder } from "~/lib/cricket";
import { useLiveListMatch } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { MatchHero } from "./match-hero";

/**
 * A live match as the home screen's big card (the match header on its own
 * card), opened by a tap anywhere on it, with "Watch live", and "Score" for its scorers. Follows the
 * match's live_state like the list cards.
 */
export function LiveHeroCard({
  match: fetched,
  canScore = false,
}: {
  match: Match;
  canScore?: boolean;
}) {
  const match = useLiveListMatch(fetched);
  const sides = sidesInBattingOrder({
    ...match,
    team1_id: match.team1_id ?? match.team1.id,
    team2_id: match.team2_id ?? match.team2.id,
  });
  const href = `/matches/${match.id}`;
  return (
    // The whole card opens the match, like every other match card (N9): a
    // link stretched over it, under the buttons.
    <div className="relative h-full">
      <Link
        href={href}
        aria-label={`${match.team1.name} versus ${match.team2.name}, live: open the match`}
        className="absolute inset-0 z-[1] rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <MatchHero
        match={match}
        sides={sides}
        plain={false}
        performers={false}
        className="h-full"
      >
        <div className="relative z-[2] flex gap-2">
          <Button
            asChild
            className="flex-1"
            variant={canScore ? "outline" : "default"}
          >
            {/* "Watch": "Follow" elsewhere means subscribing. */}
            <Link href={href}>Watch live</Link>
          </Button>
          {canScore && (
            <Button asChild className="flex-1">
              <Link href={`${href}/score`}>Score</Link>
            </Button>
          )}
        </div>
      </MatchHero>
    </div>
  );
}
