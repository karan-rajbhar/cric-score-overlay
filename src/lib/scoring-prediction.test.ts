import { describe, expect, it } from "vitest";
import type { InningsRow } from "./firebase/types";
import type { OversRow } from "./firebase/scorecard";
import type { QueuedAction } from "./offline-queue";
import { applyLiveResync, mergeScoringDeltas } from "./scoring-delta";
import {
  baseWithDocs,
  foldPending,
  isPendingBallId,
  predictBall,
  type PredictionBase,
} from "./scoring-prediction";

const M = "m1";
const INN = "inn1";

const batter = (id: string, pos: number, striker: boolean, out = false) => ({
  user_id: id,
  batting_position: pos,
  runs_scored: 0,
  balls_faced: 0,
  minutes_batted: 0,
  fours: 0,
  sixes: 0,
  is_out: out,
  dismissal_type: out ? "bowled" : null,
  bowler_id: null,
  fielder_id: null,
  is_current_batsman: !out,
  is_striker: striker,
});

const bowler = (id: string, current: boolean) => ({
  user_id: id,
  overs_bowled: 0,
  balls_bowled: 0,
  runs_conceded: 0,
  wickets_taken: 0,
  maidens: 0,
  wides: 0,
  no_balls: 0,
  is_current_bowler: current,
});

const MATCH = {
  id: M,
  status: "live",
  current_innings: 1,
  team1_id: "t1",
  team2_id: "t2",
  balls_per_over: 6,
  overs_per_innings: 1,
  wickets_per_innings: 10,
  max_balls_per_over: null,
  last_ball_seq: null,
};

function innings(over: Partial<InningsRow> = {}): InningsRow & { id: string } {
  return {
    id: INN,
    match_id: M,
    team_id: "t1",
    innings_number: 1,
    total_runs: 0,
    total_wickets: 0,
    total_overs: 0,
    total_balls: 0,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    extras_bonuses: 0,
    is_completed: false,
    target_runs: null,
    created_at: null,
    updated_at: null,
    batting: [batter("p1", 1, true), batter("p2", 2, false)],
    bowling: [bowler("b1", true)],
    fall_of_wickets: [],
    partnerships: [],
    last_ball: null,
    last_over_bowler_id: null,
    last_ball_seq: 0,
    ...over,
  };
}

const NAMES = new Map(
  ["p1", "p2", "p3", "b1", "b2"].map((id) => [id, { id, full_name: id }]),
);

function stateOf(inn = innings(), overs: OversRow[] = [], match = MATCH) {
  const snapshot = applyLiveResync(
    {
      match: {
        ...match,
        innings: [{ id: INN, innings_number: 1, team_id: "t1", total_balls: 0 }],
      },
      strikerId: null,
      nonStrikerId: null,
      bowlerId: null,
      lastOverBowlerId: null,
      thisOverDeliveries: [] as unknown[],
    },
    [inn],
    overs.map((o) => [o.id, o] as const),
    NAMES,
  )!;
  return { snapshot, base: { innings: inn, overs } as PredictionBase };
}

let n = 0;
const ball = (runs: number, extra: Record<string, unknown> = {}): QueuedAction => ({
  queueId: `q${(n += 1)}`,
  matchId: M,
  type: "recordBall",
  enqueuedAt: 0,
  instant: true,
  payload: {
    matchId: M,
    bowlerId: "b1",
    batsmanId: "p1",
    nonStrikerId: "p2",
    event: { runsScored: runs, ...extra },
  },
});

/** Each delivery faced by whoever is on strike after the ones before. */
function over(runs: number[]): QueuedAction[] {
  let s = "p1";
  let ns = "p2";
  return runs.map((r, i) => {
    const a = ball(r) as QueuedAction & { type: "recordBall" };
    a.payload = { ...a.payload, batsmanId: s, nonStrikerId: ns };
    if (r % 2 === 1) [s, ns] = [ns, s];
    if (i === 5) [s, ns] = [ns, s];
    return a;
  });
}

describe("instant scoring predictions", () => {
  it("applies queued deliveries in order with strike rotation", () => {
    const folded = foldPending(stateOf(), over([1, 4, 0]), NAMES);
    expect(folded).toMatchObject({ applied: 3, waiting: false });
    const s = folded.state.snapshot;
    expect(s.strikerId).toBe("p2");
    expect(s.thisOverDeliveries).toHaveLength(3);
    expect(
      (s.thisOverDeliveries as Array<{ id: string }>).every((d) =>
        isPendingBallId(d.id),
      ),
    ).toBe(true);
    const inn = s.match.innings![0] as unknown as { total_runs: number };
    expect(inn.total_runs).toBe(5);
  });

  it("stops at an action it does not predict and waits for the server", () => {
    const undo: QueuedAction = {
      queueId: "u",
      matchId: M,
      type: "undoLastBall",
      enqueuedAt: 0,
      payload: {},
    };
    const folded = foldPending(stateOf(), [ball(1), undo, ball(2)], NAMES);
    expect(folded).toMatchObject({
      applied: 1,
      waiting: true,
      reason: "unpredicted_undoLastBall",
    });
  });

  it("waits after a delivery that ends the innings", () => {
    // A one-over innings: the sixth legal ball ends it.
    const folded = foldPending(stateOf(), over([0, 0, 0, 0, 0, 1]), NAMES);
    expect(folded).toMatchObject({
      applied: 6,
      waiting: true,
      endsInnings: true,
    });
  });

  it("refuses what the engine refuses, or what it cannot reproduce", () => {
    // The dismissed player must be at the crease.
    expect(
      predictBall(stateOf(), ball(0, { isWicket: true, dismissedPlayerId: "p3" }) as never, NAMES, ""),
    ).toEqual({ ok: false, reason: "dismissed_player_not_at_crease" });
    // Not the batter on strike: the engine would recompute instead.
    const wrong = ball(1) as QueuedAction & { type: "recordBall" };
    wrong.payload = { ...wrong.payload, batsmanId: "p2", nonStrikerId: "p1" };
    expect(predictBall(stateOf(), wrong, NAMES, "")).toEqual({
      ok: false,
      reason: "not_incremental",
    });
    // Match rules the incremental engine leaves to a recompute.
    expect(
      predictBall(stateOf(innings(), [], { ...MATCH, max_balls_per_over: 8 } as never), ball(1) as never, NAMES, ""),
    ).toEqual({ ok: false, reason: "not_incremental" });
    // A finished match.
    expect(
      predictBall(stateOf(innings(), [], { ...MATCH, status: "completed" }), ball(1) as never, NAMES, ""),
    ).toEqual({ ok: false, reason: "match_not_live" });
  });

  it("does not guess an over document it has not seen", () => {
    // The innings' last ball is in over 0 but over 0's document is missing.
    const inn = innings({
      total_balls: 1,
      last_ball: { id: "x", over_number: 0 } as never,
    });
    expect(predictBall(stateOf(inn), ball(1) as never, NAMES, "")).toEqual({
      ok: false,
      reason: "over_unknown",
    });
  });

  it("refuses a bowler who bowled the previous over, and an outgoing batter", () => {
    // A one-over innings would end here; use a longer one.
    const long = { ...MATCH, overs_per_innings: 20 };
    const done = foldPending(stateOf(innings(), [], long), over([0, 0, 0, 0, 0, 0]), NAMES);
    expect(done.state.snapshot.bowlerId).toBeNull();
    const same: QueuedAction = {
      queueId: "s",
      matchId: M,
      type: "setBowler",
      enqueuedAt: 0,
      payload: { bowlerId: "b1" },
    };
    expect(foldPending(done.state, [same], NAMES)).toMatchObject({
      applied: 0,
      reason: "same_bowler_next_over",
    });
    const next = foldPending(done.state, [{ ...same, payload: { bowlerId: "b2" } }], NAMES);
    expect(next.applied).toBe(1);
    expect(next.state.snapshot.bowlerId).toBe("b2");
    expect(next.state.snapshot.thisOverDeliveries).toEqual([]);

    const out = innings({
      batting: [batter("p1", 1, true), batter("p2", 2, false), batter("p3", 3, false, true)],
    });
    const crease: QueuedAction = {
      queueId: "c",
      matchId: M,
      type: "setBatsmen",
      enqueuedAt: 0,
      payload: { strikerId: "p3", nonStrikerId: "p2" },
    };
    expect(foldPending(stateOf(out), [crease], NAMES)).toMatchObject({
      applied: 0,
      reason: "player_already_out",
    });
  });

  it("keeps the base only while it is the current innings", () => {
    const { snapshot, base } = stateOf();
    const o: OversRow = {
      id: `${INN}_0`,
      match_id: M,
      innings_id: INN,
      over_number: 0,
      balls: [],
      updated_at: null,
    };
    const moved = baseWithDocs(base, snapshot, [innings({ total_runs: 9 })], [o]);
    expect(moved?.innings.total_runs).toBe(9);
    expect(moved?.overs).toEqual([o]);
    const otherInnings = {
      ...snapshot,
      match: { ...snapshot.match, current_innings: 2 },
    };
    expect(baseWithDocs(base, otherInnings, [], [])).toBeNull();
  });
});

describe("mergeScoringDeltas", () => {
  const match = { id: M } as never;
  it("keeps each document's last version", () => {
    const a = { match, innings: [{ id: "i", total_runs: 1 }], overs: [{ id: "o0", balls: [1] }] };
    const b = { match, innings: [{ id: "i", total_runs: 4 }], overs: [{ id: "o1", balls: [] }] };
    expect(mergeScoringDeltas([a, b] as never)).toEqual({
      match,
      innings: [{ id: "i", total_runs: 4 }],
      overs: [{ id: "o0", balls: [1] }, { id: "o1", balls: [] }],
    });
  });
  it("is unknown when one of them is", () => {
    expect(mergeScoringDeltas([null])).toBeNull();
    expect(mergeScoringDeltas([])).toBeNull();
  });
});
