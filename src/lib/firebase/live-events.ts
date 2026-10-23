/**
 * `live_state.events`: what the change behind a live_state version did, so
 * the overlay can react (stings, milestone cards, end-of-over straps)
 * without guessing from score differences.
 *
 * Pure: built by `composeLiveMatchState` from documents the scoring
 * transaction already holds (the delivery, its innings after the ball, its
 * over, and the previous live row). Only a recorded delivery and a crease /
 * bowler change emit events; undo, edits and every other rebuild publish
 * none, so an undone ball never fires anything.
 */

import { battingRowsOf, bowlingRowsOf } from "./scorecard";
import { NON_BOWLER_DISMISSALS } from "./scoring/recompute";
import type {
  BallByBallRow,
  InningsRow,
  LiveEvent,
  LiveEventType,
  LiveMatchStateRow,
} from "./types";

/** Runs at which a batter's innings is celebrated. */
export const BATTER_MILESTONES = [50, 100, 150, 200] as const;
/** Wickets at which a bowler's figures are celebrated. */
export const BOWLER_MILESTONES = [3, 5] as const;
/** Partnership runs worth a card. */
export const PARTNERSHIP_MILESTONES = [50, 100, 150, 200, 250] as const;

/** The delivery a `record_ball` just committed. */
export interface DeliveryContext {
  ball: BallByBallRow;
  /** The ball's innings after it (scorecard arrays, totals). */
  innings: InningsRow;
  /** The balls of its over after it, in order (null: not known). */
  overBalls: BallByBallRow[] | null;
  ballsPerOver: number;
  /** The bowler's consecutive wicket-taking deliveries, this one included. */
  wicketStreak: number;
}

type NameOf = (id: string | null | undefined) => string | null;

function event(
  type: LiveEventType,
  fields: Partial<Omit<LiveEvent, "type">> = {},
): LiveEvent {
  return {
    type,
    player_id: fields.player_id ?? null,
    name: fields.name ?? null,
    value: fields.value ?? null,
    runs: fields.runs ?? null,
    balls: fields.balls ?? null,
    wickets: fields.wickets ?? null,
    number: fields.number ?? null,
  };
}

/** Wides and no-balls are not legal deliveries (they are bowled again). */
export function isLegalDelivery(ball: Pick<BallByBallRow, "extra_type">) {
  return ball.extra_type !== "wide" && ball.extra_type !== "no_ball";
}

/** Penalty runs and other log events are not deliveries. */
function isDelivery(ball: BallByBallRow): boolean {
  if (ball.penalty_team_id) return false;
  return (
    ball.extra_type !== "penalty" &&
    ball.extra_type !== "bonus" &&
    ball.dismissal_type !== "retired_hurt" &&
    ball.dismissal_type !== "retired_out"
  );
}

/** A wicket the bowler is credited with. */
export function isBowlerWicket(
  ball: Pick<BallByBallRow, "is_wicket" | "dismissal_type">,
): boolean {
  return (
    ball.is_wicket === true &&
    !NON_BOWLER_DISMISSALS.has(ball.dismissal_type ?? "")
  );
}

/**
 * Each bowler's run of consecutive wicket-taking deliveries after `ball`
 * (kept between deliveries in `live_state.refs`): a credited wicket adds
 * one, any other legal ball by that bowler ends the run. Wides and
 * no-balls without a credited wicket leave it alone.
 */
export function nextWicketStreaks(
  streaks: Readonly<Record<string, number>>,
  ball: BallByBallRow,
): Record<string, number> {
  const out = { ...streaks };
  const bowler = ball.bowler_id;
  if (!bowler || !isDelivery(ball)) return out;
  if (isBowlerWicket(ball)) out[bowler] = (out[bowler] ?? 0) + 1;
  else if (isLegalDelivery(ball)) delete out[bowler];
  return out;
}

function crossed(
  marks: readonly number[],
  before: number,
  after: number,
): number | null {
  let hit: number | null = null;
  for (const m of marks) if (before < m && m <= after) hit = m;
  return hit;
}

/** A batter's runs in a live row (striker or non-striker), if there. */
function runsIn(row: LiveMatchStateRow | null, id: string): number | null {
  if (!row) return null;
  if (row.striker_id === id) return row.striker_runs ?? 0;
  if (row.non_striker_id === id) return row.non_striker_runs ?? 0;
  return null;
}

function batterEvents(
  prev: LiveMatchStateRow | null,
  d: DeliveryContext,
  nameOf: NameOf,
): LiveEvent[] {
  const { ball, innings } = d;
  const out: LiveEvent[] = [];
  const offBat = ball.extra_type === "wide" ? 0 : (ball.runs_scored ?? 0);
  const batterId = ball.batsman_id;
  if (offBat === 4 || offBat === 6) {
    out.push(
      event(offBat === 4 ? "four" : "six", {
        player_id: batterId,
        name: nameOf(batterId),
      }),
    );
  }
  if (ball.is_wicket) {
    const outId = ball.dismissed_player_id ?? batterId;
    const row = battingRowsOf(innings).find((b) => b.user_id === outId);
    out.push(
      event("wicket", {
        player_id: outId,
        name: nameOf(outId),
        runs: row?.runs_scored ?? null,
        balls: row?.balls_faced ?? null,
        wickets: innings.total_wickets ?? null,
      }),
    );
  }
  if (batterId) {
    const row = battingRowsOf(innings).find((b) => b.user_id === batterId);
    const after = row?.runs_scored ?? 0;
    const before = runsIn(prev, batterId) ?? after - offBat;
    const mark = crossed(BATTER_MILESTONES, before, after);
    if (mark !== null) {
      out.push(
        event("batter_milestone", {
          player_id: batterId,
          name: nameOf(batterId),
          value: mark,
          runs: after,
          balls: row?.balls_faced ?? null,
        }),
      );
    }
  }
  return out;
}

function bowlerEvents(d: DeliveryContext, nameOf: NameOf): LiveEvent[] {
  const { ball, innings } = d;
  const id = ball.bowler_id;
  if (!id || !isBowlerWicket(ball)) return [];
  const out: LiveEvent[] = [];
  const row = bowlingRowsOf(innings).find((b) => b.user_id === id);
  const after = row?.wickets_taken ?? 0;
  const mark = crossed(BOWLER_MILESTONES, after - 1, after);
  const figures = {
    player_id: id,
    name: nameOf(id),
    wickets: after,
    runs: row?.runs_conceded ?? null,
    balls: row?.balls_bowled ?? null,
  };
  if (mark !== null) {
    out.push(event("bowler_milestone", { ...figures, value: mark }));
  }
  if (d.wicketStreak === 3) out.push(event("hat_trick", figures));
  return out;
}

function partnershipEvent(
  prev: LiveMatchStateRow | null,
  next: LiveMatchStateRow,
  d: DeliveryContext,
): LiveEvent[] {
  if (d.ball.is_wicket || !prev) return [];
  if (prev.innings_number !== next.innings_number) return [];
  const mark = crossed(
    PARTNERSHIP_MILESTONES,
    prev.partnership_runs ?? 0,
    next.partnership_runs ?? 0,
  );
  return mark === null
    ? []
    : [
        event("partnership_milestone", {
          value: mark,
          runs: next.partnership_runs,
          balls: next.partnership_balls,
        }),
      ];
}

function overEndEvent(d: DeliveryContext, nameOf: NameOf): LiveEvent[] {
  const { ball, innings, overBalls, ballsPerOver } = d;
  const total = innings.total_balls ?? 0;
  if (!overBalls || !isLegalDelivery(ball)) return [];
  if (total === 0 || total % ballsPerOver !== 0) return [];
  const shown = overBalls.filter(isDelivery);
  return [
    event("over_end", {
      number: total / ballsPerOver,
      player_id: ball.bowler_id,
      name: nameOf(ball.bowler_id),
      runs: shown.reduce(
        (n, b) => n + (b.runs_scored ?? 0) + (b.extras ?? 0),
        0,
      ),
      wickets: shown.filter((b) => b.is_wicket).length,
    }),
  ];
}

/** Events of a recorded delivery. */
export function deliveryEvents(
  prev: LiveMatchStateRow | null,
  next: LiveMatchStateRow,
  d: DeliveryContext,
  nameOf: NameOf,
): LiveEvent[] {
  if (!isDelivery(d.ball)) return [];
  const out = [
    ...batterEvents(prev, d, nameOf),
    ...bowlerEvents(d, nameOf),
    ...partnershipEvent(prev, next, d),
    ...overEndEvent(d, nameOf),
  ];
  if (d.innings.is_completed) {
    out.push(
      event("innings_end", {
        number: d.innings.innings_number,
        runs: d.innings.total_runs ?? 0,
        wickets: d.innings.total_wickets ?? 0,
        balls: d.innings.total_balls ?? 0,
      }),
    );
  }
  if (next.status === "completed" && prev?.status !== "completed") {
    out.push(event("match_end"));
  }
  return out;
}

/**
 * Events of a crease / bowler change: a batter new to the crease who has
 * not faced a ball, a bowler who was not bowling before.
 */
export function creaseEvents(
  prev: LiveMatchStateRow | null,
  next: LiveMatchStateRow,
): LiveEvent[] {
  if (!prev || prev.innings_number !== next.innings_number) return [];
  const out: LiveEvent[] = [];
  const before = new Set(
    [prev.striker_id, prev.non_striker_id].filter((x): x is string => !!x),
  );
  const crease: Array<[string | null | undefined, string | null, number]> = [
    [next.striker_id, next.striker_name, next.striker_balls ?? 0],
    [next.non_striker_id, next.non_striker_name, next.non_striker_balls ?? 0],
  ];
  for (const [id, name, balls] of crease) {
    if (id && !before.has(id) && balls === 0) {
      out.push(event("new_batter", { player_id: id, name }));
    }
  }
  if (next.bowler_id && next.bowler_id !== prev.bowler_id) {
    out.push(
      event("new_bowler", {
        player_id: next.bowler_id,
        name: next.current_bowler_name,
        wickets: next.bowler_wickets ?? 0,
        runs: next.bowler_runs ?? 0,
        balls: next.bowler_balls ?? 0,
      }),
    );
  }
  return out;
}
