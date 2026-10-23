"use client";

import { Card } from "~/components/ds/card";
import { OverStrip, type BallKind } from "~/components/ds/ball";
import {
  CreaseTable,
  type BatterFigures,
  type BowlerFigures,
} from "~/components/ds/scorecard";
import {
  bowlerEconomy,
  dlsRevisionFor,
  formatBowlerOvers,
  formatDismissalType,
  inningsBalls,
  inningsOvers,
  runRate,
  requiredRunRate,
  strikeRate,
  teamName,
} from "~/lib/cricket";
import { useLiveState } from "~/lib/hooks/useLiveState";
import { winPredictorFromLive } from "~/lib/win-predictor";
import type { Innings, Match } from "~/lib/match-types";

/** A ball of `live_state.this_over_balls` ("1", "W", "wd", "2+nb") as a chip. */
export function overBallChip(token: string): { kind: BallKind; label: string } {
  if (token === "W") return { kind: "wicket", label: "W" };
  if (/wd|nb/.test(token)) return { kind: "extra", label: token };
  if (token === "4") return { kind: "four", label: "4" };
  if (token === "6") return { kind: "six", label: "6" };
  if (token === "0") return { kind: "dot", label: "0" };
  return { kind: "run", label: token };
}

function Figure({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-score text-xl font-semibold tabular-nums leading-none text-foreground">
        {value}
        {detail && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

/** The innings in progress: the open one, else the latest. */
function currentInningsOf(match: Match): Innings | undefined {
  const all = [...(match.innings ?? [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );
  return all.find((i) => !i.is_completed) ?? all.at(-1);
}

/**
 * The live match at a glance, after the Match centre screen in /design: the
 * batters at the crease and the bowler with this over under them, then the
 * rates and the stand. Figures come from the live scorecard and
 * `live_state` the page already follows (no reads of its own).
 */
export function MatchLivePanel({ match }: { match: Match }) {
  const { state } = useLiveState(match.id);
  const inn = currentInningsOf(match);
  if (!inn || inn.is_completed) return null;
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;

  const atCrease = (inn.batting_performances ?? [])
    .filter((b) => b.is_current_batsman && !b.is_out)
    .sort((a, b) => (a.batting_position ?? 99) - (b.batting_position ?? 99));
  const batters: BatterFigures[] = atCrease.map((b) => ({
    name: b.user?.full_name ?? "Batter",
    runs: b.runs_scored,
    balls: b.balls_faced,
    fours: b.fours,
    sixes: b.sixes,
    strikeRate: strikeRate(b.runs_scored, b.balls_faced),
  }));
  const striker = atCrease.find((b) => b.is_striker)?.user?.full_name;
  // live_state describes the same innings only once it has caught up.
  const live =
    state && state.innings_number === inn.innings_number ? state : null;
  const bowling = (inn.bowling_performances ?? []).find(
    (b) => b.is_current_bowler,
  );
  const bowler: BowlerFigures | undefined = bowling && {
    name: bowling.user?.full_name ?? live?.current_bowler_name ?? "Bowler",
    overs: formatBowlerOvers(bowling, bpo),
    maidens: bowling.maidens,
    runs: bowling.runs_conceded,
    wickets: bowling.wickets_taken,
    economy: bowlerEconomy(bowling, bpo),
  };

  const thisOver = (live?.this_over_balls ?? "")
    .split(" ")
    .filter(Boolean)
    .map(overBallChip);

  const balls = inningsBalls(inn, bpo);
  const runs = inn.total_runs ?? 0;
  const stand = inn.partnerships?.find((p) => p.is_current);
  const standRuns = stand?.runs ?? live?.partnership_runs;
  const standBalls = stand?.balls ?? live?.partnership_balls;
  // The overs this innings has: a DLS revision's when there is one.
  const overs = inningsOvers(match, inn.innings_number);
  const dls = dlsRevisionFor(match, inn.innings_number);
  const maxBalls = overs ? overs * bpo : 0;
  const left = Math.max(0, maxBalls - balls);
  const target = inn.target_runs;
  const need = target ? Math.max(0, target - runs) : 0;
  const batting = teamName(match, inn.team_id);
  // Nobody out yet and no ball bowled: before the start, or between innings.
  const waiting = balls === 0 && runs === 0 && batters.length === 0 && !bowler;

  const lastWicket =
    live?.last_ball_is_wicket && live.last_ball_dismissed_player
      ? `${live.last_ball_dismissed_player}, ${formatDismissalType(live.last_ball_dismissal_type).toLowerCase()}${live.last_ball_fielder ? ` (${live.last_ball_fielder})` : ""}`
      : null;
  const lastBall = live?.last_ball_commentary || lastWicket;
  // From the live row already followed: no reads. Always an estimate.
  const estimate = live
    ? winPredictorFromLive(live, {
        ballsPerOver: bpo,
        wicketsPerInnings: match.wickets_per_innings ?? undefined,
      })
    : null;
  const estimateLine = !estimate
    ? null
    : estimate.kind === "chase"
      ? `${batting} ${estimate.battingPct}% to win`
      : `${batting} to finish on ${estimate.low} to ${estimate.high}`;

  const figures = [
    balls > 0 && (
      <Figure key="rr" label="Run rate" value={runRate(runs, balls, bpo)} />
    ),
    target && <Figure key="target" label="Target" value={target} />,
    target && (
      <Figure
        key="rrr"
        label="Required rate"
        value={requiredRunRate(need, left, bpo)}
      />
    ),
    !target && maxBalls > 0 && balls > 0 && (
      <Figure
        key="proj"
        label="Projected score"
        value={Math.round(runs + (runs / balls) * left)}
      />
    ),
    standRuns != null && balls > 0 && (
      <Figure
        key="stand"
        label="Partnership"
        value={standRuns}
        detail={standBalls != null ? `(${standBalls})` : undefined}
      />
    ),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {waiting && (
        <Card className="p-4 text-sm text-foreground">
          {inn.innings_number > 1 && target ? (
            <p>
              <span className="font-semibold">Innings break.</span> {batting}{" "}
              need {target} {target === 1 ? "run" : "runs"} to win
              {dls ? ` in ${dls.overs} overs` : ""}.
            </p>
          ) : (
            <p>
              <span className="font-semibold">Yet to start.</span> {batting}{" "}
              bat first.
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            The batters, bowler and this over appear here from the first ball.
          </p>
        </Card>
      )}
      {(batters.length > 0 || bowler) && (
        <Card className="overflow-hidden">
          <CreaseTable
            batters={batters}
            strikerName={striker}
            bowler={bowler}
          />
          <div className="border-t border-border px-4 py-3">
            {thisOver.length > 0 ? (
              <OverStrip
                balls={thisOver}
                total={live?.this_over_runs ?? undefined}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                This over: yet to start
              </p>
            )}
          </div>
          {lastBall && (
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              {lastBall}
            </p>
          )}
        </Card>
      )}
      {figures.length > 0 && (
        <Card className="p-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{figures}</dl>
          {dls && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Target revised by the DLS method: {dls.target_runs}{" "}
              {dls.target_runs === 1 ? "run" : "runs"} in {dls.overs} overs.
            </p>
          )}
          {estimateLine && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="font-medium">Estimate:</span> {estimateLine}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
