/**
 * A no-ball counts as a ball the striker faced (they receive it and may
 * score off it), however its runs came: off the bat, byes, leg byes or
 * none. A wide does not, unless `wide_counts_as_ball_faced`. A match can
 * leave no-balls out (`noball_counts_as_ball_faced` false). The screen's
 * prediction (`ballDocsAfter`) must equal the server's recompute.
 */

import { describe, expect, it } from "vitest";
import { ballDocsAfter, checkBallArgs, type RecordBallArgs } from "./ball-docs";
import { ballFaced, recomputeInnings, type BallInput } from "./recompute";
import { oversOfBalls, scorecardFields } from "../scorecard";
import type { BallByBallRow, InningsRow, MatchesRow } from "../types";
import {
  buildContextFromMatch,
  processDeliveryLocally,
} from "~/lib/offline-scoring-engine";

const NOW = "2026-01-01T00:00:00.000Z";
type Match = MatchesRow & { id: string };
type Innings = InningsRow & { id: string };

function matchWith(rules: Partial<MatchesRow> = {}): Match {
  return {
    id: "m1",
    balls_per_over: 6,
    max_balls_per_over: null,
    current_innings: 1,
    status: "live",
    wide_runs_to_batsman: false,
    noball_extras_to_batsman: false,
    wide_counts_as_ball_faced: false,
    ...rules,
  } as unknown as Match;
}

function stored(match: Match, balls: BallInput[]): Innings {
  const out = recomputeInnings({
    match,
    innings: { id: "i1", match_id: "m1" },
    balls,
    existingBatting: [],
    existingBowling: [],
    now: NOW,
  });
  return {
    id: "i1",
    match_id: "m1",
    innings_number: 1,
    team_id: "t1",
    is_completed: false,
    ...out.inningsPatch,
    ...scorecardFields({
      batting: out.batting,
      bowling: out.bowling,
      fallOfWickets: out.fallOfWickets,
      partnerships: out.partnerships,
      balls: balls as BallByBallRow[],
      totalBalls: out.inningsPatch.total_balls ?? 0,
      ballsPerOver: 6,
    }),
    last_ball_seq: balls.at(-1)?.seq ?? 0,
  } as Innings;
}

let seq = 0;
function ball(fields: Partial<BallInput>): BallInput {
  seq += 1;
  return {
    id: `i1_0~b${seq}`,
    match_id: "m1",
    innings_id: "i1",
    over_number: 0,
    ball_number: 1,
    bowler_id: "w1",
    batsman_id: "a1",
    non_striker_id: "a2",
    runs_scored: 0,
    extras: 0,
    extra_type: null,
    is_wicket: false,
    dismissal_type: null,
    fielder_id: null,
    dismissed_player_id: null,
    commentary: null,
    shot_zone: null,
    seq,
    ...fields,
  };
}

const NO_BALLS: Array<[string, Partial<BallInput>]> = [
  ["no runs", { extras: 1, extra_type: "no_ball" }],
  ["off the bat", { runs_scored: 2, extras: 1, extra_type: "no_ball" }],
  ["a four off the bat", { runs_scored: 4, extras: 1, extra_type: "no_ball" }],
  ["byes", { extras: 3, extra_type: "no_ball", no_ball_runs: "bye" }],
  ["leg byes", { extras: 2, extra_type: "no_ball", no_ball_runs: "leg_bye" }],
];

const striker = (doc: Innings) =>
  (doc.batting ?? []).find((b) => b.user_id === "a1");

describe("balls faced", () => {
  it.each(NO_BALLS)("counts a no-ball (%s) as a ball the striker faced", (_l, nb) => {
    seq = 0;
    const doc = stored(matchWith(), [ball(nb)]);
    expect(striker(doc)).toMatchObject({ balls_faced: 1 });
    // Not one of the over, nor the bowler's balls.
    expect(doc).toMatchObject({ total_balls: 0 });
    expect(doc.bowling?.[0]).toMatchObject({ balls_bowled: 0, no_balls: 1 });
    // The stand counts the ball its batter faced.
    expect(doc.partnerships?.[0]).toMatchObject({ balls: 1, batsman1_balls: 1 });
  });

  it.each(NO_BALLS)("leaves a no-ball (%s) out where the match says so", (_l, nb) => {
    seq = 0;
    const doc = stored(matchWith({ noball_counts_as_ball_faced: false }), [ball(nb)]);
    expect(striker(doc)).toMatchObject({ balls_faced: 0 });
  });

  it("counts a wide only where the match says so", () => {
    seq = 0;
    expect(
      striker(stored(matchWith(), [ball({ extras: 1, extra_type: "wide" })])),
    ).toMatchObject({ balls_faced: 0 });
    seq = 0;
    expect(
      striker(
        stored(matchWith({ wide_counts_as_ball_faced: true }), [
          ball({ extras: 1, extra_type: "wide" }),
        ]),
      ),
    ).toMatchObject({ balls_faced: 1 });
  });

  it("gives the strike rate from those balls", () => {
    seq = 0;
    const doc = stored(matchWith(), [
      ball({ runs_scored: 4 }),
      ball({ runs_scored: 2, extras: 1, extra_type: "no_ball" }),
      ball({ extras: 1, extra_type: "wide" }),
    ]);
    expect(striker(doc)).toMatchObject({ runs_scored: 6, balls_faced: 2 });
  });

  it("never counts an event between balls", () => {
    expect(ballFaced({}, { bowler_id: null, extra_type: "penalty" })).toBe(false);
    expect(ballFaced({}, { bowler_id: null, extra_type: null })).toBe(false);
  });

  it("is predicted exactly as the server recomputes it, under each setting", () => {
    for (const rules of [
      {},
      { noball_counts_as_ball_faced: false },
      { wide_counts_as_ball_faced: true },
      { noball_extras_to_batsman: true },
    ]) {
      const match = matchWith(rules);
      for (const [, nb] of [
        ...NO_BALLS,
        ["wide", { extras: 2, extra_type: "wide" }] as const,
      ]) {
        seq = 0;
        const log = [ball({ runs_scored: 1 })];
        const doc = stored(match, log);
        const args: RecordBallArgs = {
          p_match_id: "m1",
          p_bowler_id: "w1",
          p_batsman_id: "a2",
          p_non_striker_id: "a1",
          p_runs_scored: nb.runs_scored ?? 0,
          p_extras: nb.extras ?? 0,
          p_extra_type: nb.extra_type ?? null,
          p_no_ball_runs: nb.no_ball_runs ?? null,
        };
        const res = checkBallArgs(args);
        if (!res.ok) throw new Error(res.code);
        const docs = ballDocsAfter({
          match,
          innings: doc,
          overDoc: oversOfBalls("m1", "i1", log as BallByBallRow[], NOW)[0] ?? null,
          args,
          checked: res.checked,
          ballRandom: "x",
          now: NOW,
        });
        expect(docs).not.toBeNull();
        const server = stored(match, [...log, docs!.ball as BallInput]);
        const shown = { ...doc, ...docs!.inningsPatch } as Innings;
        const strip = (v: unknown) =>
          JSON.stringify(v, (k, val) =>
            k === "updated_at" || k === "created_at" ? undefined : val,
          );
        expect(strip(shown.batting)).toEqual(strip(server.batting));
        expect(strip(shown.partnerships)).toEqual(strip(server.partnerships));
        expect(strip(shown.bowling)).toEqual(strip(server.bowling));
      }
    }
  });

  it("offline, counts a no-ball as faced and a wide not, as the server does", () => {
    const ctx = buildContextFromMatch(
      {
        current_innings: 1,
        current_over: 0,
        current_ball: 0,
        overs_per_innings: 20,
      },
      "a1",
      "a2",
      "w1",
    );
    expect(
      processDeliveryLocally(ctx, { runsScored: 0, extras: 1, extraType: "no_ball" })
        .strikerBalls,
    ).toBe(1);
    expect(
      processDeliveryLocally(ctx, { extras: 1, extraType: "wide" }).strikerBalls,
    ).toBe(0);
    const off = buildContextFromMatch(
      {
        current_innings: 1,
        current_over: 0,
        current_ball: 0,
        overs_per_innings: 20,
        noball_counts_as_ball_faced: false,
        wide_counts_as_ball_faced: true,
      },
      "a1",
      "a2",
      "w1",
    );
    expect(
      processDeliveryLocally(off, { extras: 1, extraType: "no_ball" }).strikerBalls,
    ).toBe(0);
    expect(
      processDeliveryLocally(off, { extras: 1, extraType: "wide" }).strikerBalls,
    ).toBe(1);
  });
});
