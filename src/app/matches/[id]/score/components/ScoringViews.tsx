"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "~/components/ds/button";
import { MatchScorecard } from "~/components/matches/match-scorecard";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";
import { chaseLine, oversFromBalls } from "~/lib/cricket";
import { isTwoInningsMatch, standingLine } from "~/lib/multi-innings";
import type { Innings, Match } from "~/lib/match-types";
import { cn } from "~/lib/utils";
import {
  SCORING_VIEWS,
  scorecardMatchOf,
  type ScoringSide,
} from "../scoring-views";
import {
  OverList,
  oversToCorrect,
  type FixInnings,
  type LoggedBall,
} from "./FixMistakeDialog";

/**
 * Score / Scorecard / Balls: a segmented control in the screen's top bar
 * (Apple's control for views of one thing), each view 44 px tall to tap;
 * the chosen view is filled in the primary colour, so it reads in sun.
 * Inside the screen's `Tabs`; swiping does not switch (the keypad is
 * tapped all match).
 */
export function ScoringViewSwitch({
  sunlight = false,
  className,
}: {
  sunlight?: boolean;
  className?: string;
}) {
  return (
    <TabsList
      aria-label="Match while scoring"
      className={cn(
        // Each view a full 44 px to tap: the chosen one fills the track.
        "mx-0 grid h-11 max-w-none grid-cols-3 gap-0.5 overflow-visible rounded-full p-0",
        sunlight ? "border-2 border-black bg-white" : "bg-muted shadow-soft",
        className,
      )}
    >
      {SCORING_VIEWS.map((v) => (
        <TabsTrigger
          key={v.value}
          value={v.value}
          className={cn(
            "h-full min-w-0 truncate rounded-full bg-transparent px-1 font-semibold ring-0",
            sunlight
              ? "text-black data-[state=active]:bg-black data-[state=active]:text-white data-[state=active]:shadow-none"
              : // The chosen view filled in the primary colour, as a selected
                // tab is across the app: white on a near-white track could not
                // be told apart in daylight (1.1:1).
                "text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-primary",
          )}
        >
          {v.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

/**
 * The state of the match in one line above Scorecard and Balls (Score has
 * the full score card): the batting side's score and overs, then the chase
 * or the run rate; the result once the match is over.
 */
export function ScoringScoreLine({
  match,
  innings,
  battingName,
}: {
  match: Match;
  innings: Innings | null | undefined;
  battingName: string;
}) {
  const over = match.status === "completed" || match.status === "abandoned";
  if (over && match.result_description) {
    return (
      <p className="rounded-xl bg-card px-3.5 py-2.5 text-sm font-semibold shadow-soft">
        {match.result_description}
      </p>
    );
  }
  if (!innings) return null;
  const bpo = match.balls_per_over ?? 6;
  const balls = innings.total_balls ?? 0;
  // A Test's second and third innings: the lead or deficit, not a chase.
  const chase = over
    ? null
    : isTwoInningsMatch(match) && !innings.target_runs
      ? standingLine(match.innings ?? [], innings, battingName)
      : chaseLine(match, innings, battingName, bpo);
  const rate = balls > 0 ? (((innings.total_runs ?? 0) * bpo) / balls).toFixed(2) : null;
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5 shadow-soft">
      <p className="min-w-0 truncate">
        <span className="text-sm font-semibold">{battingName}</span>{" "}
        <span className="font-score text-lg font-bold tabular-nums">
          {innings.total_runs ?? 0}/{innings.total_wickets ?? 0}
        </span>{" "}
        <span className="font-score text-sm tabular-nums text-muted-foreground">
          ({oversFromBalls(balls, bpo)} ov)
        </span>
      </p>
      {(chase || rate) && (
        <p className="shrink-0 text-right text-xs text-muted-foreground">
          {chase ?? (
            <>
              Run rate <span className="font-score tabular-nums">{rate}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Every innings' scorecard, from what the scoring screen holds (no reads,
 * each ball as soon as the keypad shows it). Names are not links, so a
 * stray tap does not leave the scoring.
 */
export function ScoringScorecard({
  match,
  sides,
}: {
  match: Match;
  sides: readonly ScoringSide[];
}) {
  const card = useMemo(() => scorecardMatchOf(match, sides), [match, sides]);
  return <MatchScorecard match={card} links={false} />;
}

/**
 * Every over of an innings, latest first, read from the match's ball log
 * only while this view is open (and again only when the log changes:
 * `ballLogKey`). A scorer's tap on a ball or an over's bowler opens Fix a
 * mistake there.
 */
export function ScoringBalls({
  active,
  ballLogKey,
  fetchBallLog,
  offline,
  innings,
  defaultInningsId,
  sides,
  unsaved,
  onBall,
  onBowler,
}: {
  /** The view is on screen (the log is read only then). */
  active: boolean;
  ballLogKey: readonly unknown[];
  fetchBallLog: () => Promise<LoggedBall[]>;
  offline: boolean;
  innings: FixInnings[];
  /** The innings shown first: the one in play, or the last. */
  defaultInningsId: string | null;
  sides: readonly ScoringSide[];
  /** Actions still waiting to be saved (their balls are not listed yet). */
  unsaved: number;
  onBall?: (inningsId: string, ballId: string) => void;
  onBowler?: (inningsId: string, over: number) => void;
}) {
  const query = useQuery({
    queryKey: ballLogKey,
    queryFn: fetchBallLog,
    enabled: active && !offline,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
  // The innings in play until the scorer picks another.
  const [picked, setPicked] = useState<string | null>(null);
  const inningsId =
    (picked && innings.some((i) => i.id === picked) ? picked : null) ??
    defaultInningsId;
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const side of sides)
      for (const p of side.players)
        if (p.user?.full_name) map.set(p.user_id, p.user.full_name);
    return map;
  }, [sides]);
  const nameOf = (id: string | null | undefined) =>
    (id && names.get(id)) || "Unknown player";

  if (!query.data) {
    if (offline) {
      return (
        <p className="text-sm text-muted-foreground">
          The balls need a connection. This over is on Score.
        </p>
      );
    }
    if (query.isError) {
      return (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-destructive">
            Could not load the balls. Check the connection and try again.
          </p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading the balls…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {offline && (
        <p className="text-xs text-muted-foreground">
          Offline: the balls as last read.
        </p>
      )}
      {onBall && (
        <p className="text-xs text-muted-foreground">
          Tap a ball to fix it. The latest over is first.
        </p>
      )}
      <div className="rounded-xl bg-card p-3.5 shadow-soft">
        <OverList
          name="balls-innings"
          innings={innings}
          inningsId={inningsId}
          onInnings={setPicked}
          overs={inningsId ? oversToCorrect(query.data, inningsId) : []}
          nameOf={nameOf}
          onBall={
            onBall && inningsId ? (ballId) => onBall(inningsId, ballId) : undefined
          }
          onBowler={
            onBowler && inningsId ? (over) => onBowler(inningsId, over) : undefined
          }
          unsaved={unsaved}
        />
      </div>
    </div>
  );
}
