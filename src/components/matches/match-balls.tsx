"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BallChip } from "~/components/ds/ball";
import { Card } from "~/components/ds/card";
import { Chip } from "~/components/ds/chip";
import { Disclosure } from "~/components/ds/disclosure";
import { Segmented } from "~/components/ds/tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useMatchBallLogQuery } from "~/lib/hooks/useMatchQueries";
import type { BallEvent, Match } from "~/lib/match-types";
import {
  deliveryKind,
  deliveryLabel,
  formatDismissalType,
  formatExtraType,
  isWicketFall,
  teamName,
} from "~/lib/cricket";
import { howOut } from "~/lib/dismissal-detail";
import { cn } from "~/lib/utils";

type Ball = BallEvent;
type Filter = "all" | "boundaries" | "wickets";

interface MatchBallsProps {
  match: Match;
}

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All deliveries" },
  { value: "boundaries", label: "Boundaries" },
  { value: "wickets", label: "Wickets" },
];

function filterBalls(balls: Ball[], filter: Filter): Ball[] {
  if (filter === "boundaries")
    return balls.filter((b) => b.runs_scored >= 4 && !b.extra_type);
  if (filter === "wickets") return balls.filter(isWicketFall);
  return balls;
}

const runsOf = (b: Ball) => b.runs_scored + (b.extras || 0);

/** "Four", "2 runs", "1 run, wide": what the ball brought, in words. */
function runsInWords(b: Ball): string {
  if (!b.extra_type && b.runs_scored === 4) return "Four";
  if (!b.extra_type && b.runs_scored === 6) return "Six";
  const runs = runsOf(b);
  const words = runs === 0 ? "No run" : `${runs} run${runs === 1 ? "" : "s"}`;
  return b.extra_type
    ? `${words}, ${formatExtraType(b.extra_type).toLowerCase()}`
    : words;
}

/**
 * "Out, caught by Smith"; when the batter out is not the one facing (a run
 * out at the other end), by name: "Rohit run out (Smith)".
 */
function outInWords(b: Ball): string {
  const how = howOut(
    b.dismissal_type,
    b.fielder?.full_name ?? null,
    Boolean(b.fielder_id) && b.fielder_id === b.bowler_id,
  );
  return b.dismissed_player_id && b.dismissed_player_id !== b.batsman_id
    ? `${b.dismissed_player?.full_name ?? "The non-striker"} ${how}`
    : `Out, ${how}`;
}

/**
 * What happened, in words: "Four", "Out, caught by Smith", "3 runs. Out, run
 * out (Smith)". A retirement is not a dismissal: "Rohit retired hurt".
 */
export function outcomeOf(b: Ball): string {
  if (b.dismissal_type === "retired_hurt" || b.dismissal_type === "retired_out") {
    const who = b.dismissed_player?.full_name ?? b.batsman?.full_name ?? "Batter";
    return `${who} ${formatDismissalType(b.dismissal_type).toLowerCase()}`;
  }
  if (!b.is_wicket) return runsInWords(b);
  return runsOf(b) > 0
    ? `${runsInWords(b)}. ${outInWords(b)}`
    : outInWords(b);
}

const OUTCOME_TONE: Partial<Record<ReturnType<typeof deliveryKind>, string>> = {
  wicket: "text-wicket",
  four: "text-four",
  six: "text-six",
};

/**
 * One over: its deliveries as chips, then each ball in words, which fold
 * away on phones (the chips already tell the over).
 */
function OverCard({
  over,
  balls,
  open,
}: {
  over: number;
  balls: Ball[];
  open: boolean;
}) {
  const sorted = [...balls].sort((a, b) => a.ball_number - b.ball_number);
  const runs = sorted.reduce((n, b) => n + runsOf(b), 0);
  const wickets = sorted.filter(isWicketFall).length;
  // Two when one left the over injured.
  const bowlers = [
    ...new Set(sorted.flatMap((b) => b.bowler?.full_name ?? [])),
  ].join(", ");
  return (
    <Disclosure
      defaultOpen={open}
      className="[contain-intrinsic-size:auto_5.5rem] [content-visibility:auto]"
      title={
        <>
          <span className="block text-sm font-semibold text-foreground">
            Over {over + 1}
          </span>
          {bowlers && (
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {bowlers}
            </span>
          )}
        </>
      }
      aside={
        <span className="flex items-center gap-2">
          {wickets > 0 && (
            <Chip tone="danger" size="sm">
              {wickets} {wickets === 1 ? "wicket" : "wickets"}
            </Chip>
          )}
          <span className="font-score text-sm font-semibold tabular-nums text-foreground">
            {runs} {runs === 1 ? "run" : "runs"}
          </span>
        </span>
      }
      below={
        <span className="flex flex-wrap gap-1">
          {sorted.map((b) => (
            <BallChip
              key={b.id}
              kind={deliveryKind(b)}
              label={deliveryLabel(b)}
              size="sm"
              className="md:h-8 md:min-w-8 md:px-1.5 md:text-sm"
            />
          ))}
        </span>
      }
    >
      <div className="px-4 pb-3">
        <ul className="divide-y divide-border border-t border-border">
          {sorted.map((b) => (
            <li key={b.id} className="flex gap-3 py-2 text-sm">
              <span className="w-8 shrink-0 font-score text-xs tabular-nums leading-5 text-muted-foreground">
                {over}.{b.ball_number}
              </span>
              <span className="min-w-0">
                {/* Events between balls have no bowler to name. */}
                {b.bowler_id && (
                  <>
                    <span className="text-muted-foreground">
                      {b.bowler?.full_name ?? "Bowler"} to{" "}
                    </span>
                    <span className="font-medium text-foreground">
                      {b.batsman?.full_name ?? "Batter"}
                    </span>
                    <span className="text-muted-foreground">, </span>
                  </>
                )}
                <span
                  className={cn(
                    "font-medium text-foreground",
                    OUTCOME_TONE[deliveryKind(b)],
                  )}
                >
                  {outcomeOf(b)}
                </span>
                {b.commentary && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {b.commentary}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Disclosure>
  );
}

/** Ball by ball: each innings' overs, the latest first. */
export function MatchBalls({ match }: MatchBallsProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error } = useMatchBallLogQuery(match.id);
  const ballLog = (data ?? null) as Ball[] | null;
  const logError = error
    ? error instanceof Error
      ? error.message
      : String(error)
    : null;

  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  if (ballLog === null && !logError) {
    return (
      <Card className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (sortedInnings.length === 0 || logError || !ballLog) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        {logError ?? "No ball-by-ball data available yet"}
      </Card>
    );
  }

  // While it is on, the innings that matters now; once over, from the start.
  const over = match.status === "completed" || match.status === "abandoned";
  const current = over
    ? sortedInnings[0]?.innings_number
    : sortedInnings.some((inn) => inn.innings_number === match.current_innings)
      ? match.current_innings
      : sortedInnings.at(-1)?.innings_number;

  return (
    <div className="space-y-4">
      <Segmented
        label="Filter deliveries"
        options={FILTERS}
        value={filter}
        onChange={setFilter}
      />

      <Tabs defaultValue={`innings-${current ?? 1}`} className="w-full">
        <TabsList aria-label="Innings" className="mb-4">
          {sortedInnings.map((innings) => (
            <TabsTrigger
              key={innings.id}
              value={`innings-${innings.innings_number}`}
            >
              {innings.innings_number > 2
                ? "Super over"
                : teamName(match, innings.team_id)}
            </TabsTrigger>
          ))}
        </TabsList>

        {sortedInnings.map((innings) => {
          const balls = ballLog.filter((b) => b.innings_id === innings.id);
          const shown = filterBalls(balls, filter);
          const byOver = new Map<number, Ball[]>();
          for (const b of shown) {
            byOver.set(b.over_number, [
              ...(byOver.get(b.over_number) ?? []),
              b,
            ]);
          }
          const overs = [...byOver.keys()].sort((a, b) => b - a);
          return (
            <TabsContent
              key={innings.id}
              value={`innings-${innings.innings_number}`}
              className="space-y-2 md:space-y-4"
            >
              {balls.length === 0 ? (
                <Card className="py-12 text-center text-sm text-muted-foreground">
                  No ball-by-ball data for this innings
                </Card>
              ) : overs.length === 0 ? (
                <Card className="py-12 text-center text-sm text-muted-foreground">
                  {filter === "wickets"
                    ? "No wickets in this innings yet"
                    : "No boundaries in this innings yet"}
                </Card>
              ) : (
                overs.map((over, i) => (
                  <OverCard
                    key={over}
                    over={over}
                    balls={byOver.get(over)!}
                    // The latest over; a filter is there for the words.
                    open={i === 0 || filter !== "all"}
                  />
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
