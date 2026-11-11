"use client";

import { Disclosure } from "~/components/ds/disclosure";
import { Facts, factsOf } from "~/components/ds/facts";
import { fullDateTime, timeOfDay } from "~/lib/dates";
import { namedFormat } from "~/lib/cricket";
import { clubStatsFact } from "~/lib/club-side-text";
import type { Match } from "~/lib/match-types";


/**
 * The match's facts, under Summary: reference, so it folds on phones, except
 * before the start, when it is what the page is for. A fact the match does
 * not hold has no row. Whose stats count for the club shows only when a team
 * is left out, so anyone can see why its players are missing from the
 * club's leaderboards.
 */
export function MatchDetails({ match }: { match: Match }) {
  const tossWinner =
    match.toss_winner_team_id === match.team1_id
      ? match.team1.name
      : match.toss_winner_team_id === match.team2_id
        ? match.team2.name
        : null;
  const format = namedFormat(match);
  const clubStats = clubStatsFact(
    match.club_side,
    match.team1.name,
    match.team2.name,
  );
  const umpires = [match.umpire1_name, match.umpire2_name]
    .filter(Boolean)
    .join(", ");

  const facts = factsOf(
    format && ["Format", format],
    ["Overs", `${match.overs_per_innings} overs per innings`],
    match.dls_revision && [
      match.dls_revision.by_hand ? "Revised target" : "Revised target (DLS)",
      `${match.dls_revision.target_runs} runs in ${match.dls_revision.overs} overs`,
    ],
    match.ball_type && [
      "Ball",
      <span key="b" className="capitalize">
        {match.ball_type}
      </span>,
    ],
    match.venue && ["Venue", match.venue],
    match.scheduled_at && [
      "Date and time",
      fullDateTime(match.scheduled_at),
    ],
    match.actual_start_time && ["Started", timeOfDay(match.actual_start_time)],
    match.tournament && ["Tournament", match.tournament.name],
    match.club && ["Club", match.club.name],
    match.club &&
      clubStats.outside && [
        "Club stats count",
        <>
          {clubStats.counts}
          <span className="block text-xs font-normal text-muted-foreground">
            {clubStats.outside}: outside team
          </span>
        </>,
      ],
    tossWinner && [
      "Toss",
      `${tossWinner} won the toss and elected to ${match.toss_decision === "bowl" ? "bowl" : "bat"}`,
    ],
    match.weather_conditions && ["Weather", match.weather_conditions],
    match.pitch_conditions && ["Pitch", match.pitch_conditions],
    umpires && ["Umpires", umpires],
  );

  return (
    <Disclosure
      title="Match details"
      defaultOpen={match.status === "scheduled"}
      below={
        <span className="text-xs text-muted-foreground">
          Toss, venue, date and more
        </span>
      }
    >
      <Facts facts={facts} />
    </Disclosure>
  );
}
