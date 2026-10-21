"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { sidesInBattingOrder } from "~/lib/cricket";
import { useLiveListMatch } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { MatchHero } from "./match-hero";

/**
 * A live match as the home screen's big card (the match header on its own
 * card) with "Follow live", and "Score" for its scorers. Follows the
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
  return (
    <MatchHero
      match={match}
      sides={sides}
      plain={false}
      performers={false}
      className="h-full"
    >
      <div className="flex gap-2">
        <Button
          asChild
          className="flex-1"
          variant={canScore ? "outline" : "default"}
        >
          <Link href={`/matches/${match.id}`}>Follow live</Link>
        </Button>
        {canScore && (
          <Button asChild className="flex-1">
            <Link href={`/matches/${match.id}/score`}>Score</Link>
          </Button>
        )}
      </div>
    </MatchHero>
  );
}
