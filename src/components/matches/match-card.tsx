"use client";

import type * as React from "react";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  FixtureCard,
  MatchCard as MatchCardView,
} from "~/components/ds/match-card";
import { MatchNote } from "~/components/ds/score";
import {
  displayStatusOf,
  formatMatchResult,
  formatStatus,
  sidesInBattingOrder,
} from "~/lib/cricket";
import type { InningsRef } from "~/components/ds/score";
import { useLiveListMatch } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { liveLine, ref, teamRef } from "./match-hero";

interface MatchCardProps {
  match: Match;
  showActions?: boolean;
  /** Whether the signed-in user may score this match (creator/admin). */
  canScore?: boolean;
  /** A line under the result: a player's figures in this match. */
  detail?: React.ReactNode;
}

/** "Sat 25 Oct" and "14:00" for a fixture's start. */
export function matchStart(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time: d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }),
  };
}

/** "158 for 9 (20.0 overs)": a score as it is read aloud. */
const spokenScore = (inn: InningsRef) =>
  `${inn.runs} for ${inn.wickets} (${inn.overs} overs)`;

/**
 * What a screen reader hears for a card, which replaces what it shows: the
 * sides, the status, each side's score and the line under them.
 */
export function matchCardLabel({
  status,
  sides,
  note,
}: {
  status: string;
  sides: { name: string; innings?: InningsRef }[];
  note?: string | null;
}): string {
  const names = sides.map((s) => s.name).join(" versus ");
  const scores = sides
    .map((s) => `${s.name} ${s.innings ? spokenScore(s.innings) : "yet to bat"}`)
    .join(", ");
  return [`${names}, ${formatStatus(status).toLowerCase()}`, scores, note]
    .filter(Boolean)
    .join(". ");
}

/**
 * A match in a list (match centre, home, dashboard): an upcoming one as a
 * fixture (crests either side of the start time), a live or finished one
 * with both sides' scores in batting order and the chase or the result.
 * The card opens the match; a scorer also gets "Score" under it.
 */
export function MatchCard({
  match: fetched,
  showActions = true,
  canScore = false,
  detail,
}: MatchCardProps) {
  // A live match follows its live_state doc (no refresh needed).
  const match = useLiveListMatch(fetched);
  const href = `/matches/${match.id}`;
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const format = `${match.match_format} · ${match.overs_per_innings} overs`;
  const competition = match.tournament?.name ?? match.club?.name;

  const action = showActions &&
    canScore &&
    ["scheduled", "live", "innings_break"].includes(match.status) && (
      <Button asChild size="sm" variant="secondary" className="flex-1">
        <Link href={`/matches/${match.id}/score`}>
          <PlayCircle aria-hidden="true" />
          Score
        </Link>
      </Button>
    );

  if (match.status === "scheduled") {
    const start = matchStart(match.scheduled_at);
    return (
      <FixtureCard
        href={href}
        label={[
          `${match.team1.name} versus ${match.team2.name}, upcoming`,
          start ? `${start.date} at ${start.time}` : "date to be confirmed",
          match.venue,
        ]
          .filter(Boolean)
          .join(", ")}
        date={[start?.date ?? "Date to be confirmed", competition]
          .filter(Boolean)
          .join(" · ")}
        time={start?.time ?? "TBC"}
        home={teamRef(match.team1)}
        away={teamRef(match.team2)}
        venue={match.venue}
        action={action}
        className="h-full"
      />
    );
  }

  // Batting order, as on a scorecard: the side that batted first on top.
  const sides = sidesInBattingOrder({
    ...match,
    team1_id: match.team1_id ?? match.team1.id,
    team2_id: match.team2_id ?? match.team2.id,
  });
  const batting = sides.find((s) => s.innings && !s.innings.is_completed);
  const winnerId =
    match.status === "completed" ? (match.winning_team_id ?? null) : null;
  // Quieter: the losing side once finished, the fielding side while live.
  const dim = (teamId: string) =>
    winnerId ? teamId !== winnerId : !!batting && batting.team.id !== teamId;
  const side = (s: (typeof sides)[number]) => ({
    team: teamRef(s.team),
    innings: s.innings ? ref(s.innings, bpo) : undefined,
    dim: dim(s.team.id),
  });

  const status = displayStatusOf(match);
  const result = match.result_description ? formatMatchResult(match) : null;
  const chase = batting ? liveLine(match, batting, bpo) : null;
  const note = result ? (
    <MatchNote tone="result">{result}</MatchNote>
  ) : chase ? (
    <MatchNote tone="live">{chase}</MatchNote>
  ) : status === "innings_break" ? (
    <MatchNote>Innings break</MatchNote>
  ) : match.venue ? (
    <MatchNote className="truncate">{match.venue}</MatchNote>
  ) : null;
  const first = side(sides[0]);
  const second = side(sides[1]);

  return (
    <MatchCardView
      href={href}
      label={matchCardLabel({
        status,
        sides: [
          { name: first.team.name, innings: first.innings },
          { name: second.team.name, innings: second.innings },
        ],
        note: result ?? chase,
      })}
      competition={competition ? `${competition} · ${format}` : format}
      status={status}
      first={first}
      second={second}
      note={
        detail ? (
          <>
            {note}
            {detail}
          </>
        ) : (
          note
        )
      }
      action={action}
      className="h-full"
    />
  );
}
