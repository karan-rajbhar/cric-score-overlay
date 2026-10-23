/**
 * `live_state.events` and the overlay fields: a recorded delivery and a
 * crease / bowler change publish what happened; undo and edits publish
 * nothing, so an undone ball never fires a graphic.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { writeLiveState, type LiveStateDoc } from "./live-state";
import { nextWicketStreaks } from "./live-events";
import {
  GoldenReplay,
  SYNTHETIC_ROSTERS,
  syntheticTables,
  type BallSpec,
} from "./scoring/__fixtures__/golden";
import { stage2Driver } from "./scoring/__fixtures__/stage2";
import type { OversRow } from "./scorecard";
import {
  setCurrentBatsmen,
  setCurrentBowler,
  undoLastBall,
  updateBall,
} from "./rpc/scoring";
import type { BallByBallRow, LiveEvent, MatchesRow } from "./types";

function setup(incremental: boolean, overrides: Partial<MatchesRow> = {}) {
  const side = stage2Driver(syntheticTables(overrides), incremental);
  const replay = new GoldenReplay(side, "M", SYNTHETIC_ROSTERS);
  const live = () =>
    side.ds
      .all("live_state")
      .find((d) => d.id === "M") as unknown as LiveStateDoc;
  const types = () => (live().events ?? []).map((e) => e.type);
  const ball = (spec: BallSpec) => replay.step({ kind: "ball", ball: spec });
  return { side, replay, live, types, ball };
}

const byType = (events: LiveEvent[] | undefined, type: string) =>
  (events ?? []).find((e) => e.type === type);

/** a1 facing, a2 at the other end, b1 bowling: a fixed crease. */
const A1 = { batsman: "a1", nonStriker: "a2", bowler: "b1" } as const;
/** a1 facing over after over (the replay picks each over's bowler). */
const A1_ON_STRIKE = { batsman: "a1", nonStriker: "a2" } as const;

describe.each([true, false])("live_state.events (incremental: %s)", (inc) => {
  it("names the batter of a four and a six", async () => {
    const { live, types, ball } = setup(inc);
    await ball({ ...A1, runs: 4 });
    expect(types()).toEqual(["four"]);
    expect(byType(live().events, "four")).toMatchObject({
      player_id: "a1",
      name: "Player A1",
    });
    await ball({ ...A1, runs: 6 });
    expect(types()).toEqual(["six"]);
    await ball({ ...A1, runs: 1 });
    expect(types()).toEqual([]);
  });

  it("does not call byes or a wide's runs a boundary", async () => {
    const { types, ball } = setup(inc);
    await ball({ ...A1, extras: 4, extraType: "bye" });
    expect(types()).toEqual([]);
    await ball({ ...A1, extras: 5, extraType: "wide" });
    expect(types()).toEqual([]);
  });

  it("reports a wicket with the batter's figures, then nothing on undo", async () => {
    const { side, live, types, ball } = setup(inc);
    await ball({ ...A1, runs: 4 });
    await ball({ ...A1, runs: 0, wicket: "bowled" });
    expect(types()).toEqual(["wicket"]);
    expect(byType(live().events, "wicket")).toMatchObject({
      player_id: "a1",
      runs: 4,
      balls: 2,
      wickets: 1,
    });
    expect(live().last_wicket).toMatchObject({
      player_id: "a1",
      name: "Player A1",
      runs: 4,
      balls: 2,
      dismissal_type: "bowled",
      bowler_name: "Player B1",
      wicket_number: 1,
      score: 4,
    });

    await undoLastBall(side.ctx, "M");
    expect(live().events).toEqual([]);
    expect(live().last_wicket).toBeNull();
  });

  it("publishes nothing for an edit", async () => {
    const { side, live, ball } = setup(inc);
    await ball({ ...A1, runs: 1 });
    const ballId = (side.ds.all("overs") as unknown as OversRow[])[0]!
      .balls[0]!.id;
    await updateBall(side.ctx, {
      p_match_id: "M",
      p_ball_id: ballId,
      p_runs_scored: 4,
      p_extras: 0,
      p_extra_type: null,
      p_is_wicket: false,
    });
    expect(live().events).toEqual([]);
  });

  it("marks a fifty reached with a single, after the batter crossed", async () => {
    const { live, ball } = setup(inc, { overs_per_innings: 20 });
    // 8 sixes and a single: a1 ends at the other end on 49.
    for (let i = 0; i < 8; i += 1) await ball({ ...A1_ON_STRIKE, runs: 6 });
    await ball({ ...A1_ON_STRIKE, runs: 1 });
    expect(live().non_striker_id).toBe("a1");
    expect(byType(live().events, "batter_milestone")).toBeUndefined();
    // Back on strike, another single: 50.
    await ball({ ...A1_ON_STRIKE, runs: 1 });
    expect(byType(live().events, "batter_milestone")).toMatchObject({
      player_id: "a1",
      value: 50,
      runs: 50,
      balls: 10,
    });
  });

  it("counts a hat-trick only for consecutive wickets by one bowler", async () => {
    const { live, types, ball } = setup(inc, { overs_per_innings: 20 });
    const wicket = { bowler: "b1", runs: 0, wicket: "bowled" } as const;
    await ball(wicket);
    await ball({ bowler: "b1", runs: 0 });
    await ball(wicket);
    // Two in two (the dot broke the first run); also a three-for.
    await ball(wicket);
    expect(types()).toEqual(["wicket", "bowler_milestone"]);
    expect(byType(live().events, "bowler_milestone")).toMatchObject({
      player_id: "b1",
      value: 3,
      wickets: 3,
    });
    await ball(wicket);
    expect(types()).toEqual(["wicket", "hat_trick"]);
    expect(byType(live().events, "hat_trick")).toMatchObject({
      player_id: "b1",
      wickets: 4,
    });
  });

  it("names a new batter and a new bowler", async () => {
    const { side, live, types, ball } = setup(inc);
    await ball({ ...A1, runs: 0, wicket: "bowled" });
    await setCurrentBatsmen(side.ctx, "M", "a3", "a2");
    expect(types()).toEqual(["new_batter"]);
    expect(byType(live().events, "new_batter")).toMatchObject({
      player_id: "a3",
      name: "Player A3",
    });
    await setCurrentBowler(side.ctx, "M", "b2");
    expect(types()).toEqual(["new_bowler"]);
    expect(live()).toMatchObject({ bowler_id: "b2", bowler_maidens: 0 });
  });

  it("carries team colours from the team documents, none without them", async () => {
    const { side, live, ball } = setup(inc);
    await ball({ ...A1, runs: 1 });
    expect(live().team_colors).toBeNull();
    await side.ds.update("teams", "TA", { primary_color: "#0f766e" });
    await writeLiveState(side.ds, "M");
    expect(live().team_colors).toEqual({
      team1: { primary: "#0f766e", secondary: null },
      team2: null,
    });
    // The fast path keeps them from the previous live doc (no team read).
    await ball({ ...A1, runs: 1 });
    expect(live().team_colors?.team1?.primary).toBe("#0f766e");
  });

  it("carries the crease ids, boundaries and the powerplay", async () => {
    const { live, ball } = setup(inc, { overs_per_innings: 20 });
    await ball({ ...A1, runs: 4 });
    await ball({ ...A1, runs: 6 });
    expect(live()).toMatchObject({
      striker_id: "a1",
      striker_fours: 1,
      striker_sixes: 1,
      non_striker_id: "a2",
      bowler_id: "b1",
      powerplay: { end_over: 6 },
    });
  });
});

describe("live_state.events on the delivery path", () => {
  it("ends an over with its runs, then the innings", async () => {
    const { live, types, ball } = setup(true, { overs_per_innings: 1 });
    for (let i = 0; i < 5; i += 1) await ball({ ...A1, runs: 0 });
    expect(types()).toEqual([]);
    await ball({ ...A1, runs: 4 });
    expect(types()).toEqual(["four", "over_end", "innings_end"]);
    expect(byType(live().events, "over_end")).toMatchObject({
      number: 1,
      runs: 4,
      wickets: 0,
      player_id: "b1",
    });
    expect(byType(live().events, "innings_end")).toMatchObject({
      number: 1,
      runs: 4,
      wickets: 0,
      balls: 6,
    });
  });

  it("ends the match on the winning run", async () => {
    const { live, types, ball } = setup(true, { overs_per_innings: 1 });
    for (let i = 0; i < 6; i += 1) await ball({ runs: 0 });
    await ball({ runs: 1 });
    expect(types()).toContain("match_end");
    expect(live().status).toBe("completed");
  });

  it("marks a fifty partnership", async () => {
    const { live, ball } = setup(true, { overs_per_innings: 20 });
    for (let i = 0; i < 8; i += 1) await ball({ ...A1_ON_STRIKE, runs: 6 });
    await ball({ ...A1_ON_STRIKE, runs: 2 });
    expect(byType(live().events, "partnership_milestone")).toMatchObject({
      value: 50,
      runs: 50,
    });
  });
});

describe("nextWicketStreaks", () => {
  const delivery = (b: Partial<BallByBallRow>) =>
    ({
      bowler_id: "b1",
      is_wicket: false,
      dismissal_type: null,
      extra_type: null,
      ...b,
    }) as BallByBallRow;

  it("adds credited wickets and clears on another legal ball", () => {
    let s = nextWicketStreaks({}, delivery({ is_wicket: true, dismissal_type: "caught" }));
    expect(s).toEqual({ b1: 1 });
    s = nextWicketStreaks(s, delivery({ extra_type: "wide" }));
    expect(s).toEqual({ b1: 1 });
    s = nextWicketStreaks(s, delivery({ bowler_id: "b2" }));
    expect(s).toEqual({ b1: 1 });
    s = nextWicketStreaks(s, delivery({}));
    expect(s).toEqual({});
  });

  it("does not credit a run out", () => {
    expect(
      nextWicketStreaks(
        { b1: 2 },
        delivery({ is_wicket: true, dismissal_type: "run_out" }),
      ),
    ).toEqual({});
  });
});
