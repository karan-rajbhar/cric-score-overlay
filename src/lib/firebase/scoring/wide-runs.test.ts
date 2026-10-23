/**
 * Runs the batters complete on a wide are wides (held in `extras` after the
 * 1-run penalty, as the scoring screen records them), but an odd number of
 * them crosses the batters like runs off the bat; a boundary wide does not.
 * The screen's prediction (`ballDocsAfter`) must equal the server's
 * recompute, and the recompute must keep a crease the scorer chose.
 */

import { describe, expect, it } from "vitest";
import { ballDocsAfter, checkBallArgs, type RecordBallArgs } from "./ball-docs";
import { endsAfterBall, recomputeInnings, type BallInput } from "./recompute";
import { oversOfBalls, scorecardFields } from "../scorecard";
import type { BallByBallRow, InningsRow, MatchesRow } from "../types";

const NOW = "2026-01-01T00:00:00.000Z";
type Match = MatchesRow & { id: string };
type Innings = InningsRow & { id: string };

function matchWith(wideRunsToBatsman = false): Match {
  return {
    id: "m1",
    balls_per_over: 6,
    max_balls_per_over: null,
    current_innings: 1,
    status: "live",
    wide_runs_to_batsman: wideRunsToBatsman,
    noball_extras_to_batsman: false,
    wide_counts_as_ball_faced: false,
  } as unknown as Match;
}

function stored(
  match: Match,
  balls: BallInput[],
  existingBatting: Innings["batting"] = [],
): Innings {
  const out = recomputeInnings({
    match,
    innings: { id: "i1", match_id: "m1" },
    balls,
    existingBatting: (existingBatting ?? []).map((e) => ({
      ...e,
      id: `i1_${e.user_id}`,
      match_id: "m1",
      innings_id: "i1",
    })) as never[],
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

const wide = (extras: number, more: Partial<BallInput> = {}) =>
  ball({ extras, extra_type: "wide", ...more });

/** Who is on strike and who is not after `balls`. */
function crease(doc: Innings) {
  const at = (doc.batting ?? []).filter((b) => b.is_current_batsman);
  return {
    striker: at.find((b) => b.is_striker)?.user_id ?? null,
    nonStriker: at.find((b) => !b.is_striker)?.user_id ?? null,
  };
}

describe("runs on a wide", () => {
  it("cross the batters when odd, like runs off the bat", () => {
    seq = 0;
    expect(crease(stored(matchWith(), [wide(2)]))).toEqual({
      striker: "a2",
      nonStriker: "a1",
    });
    seq = 0;
    expect(crease(stored(matchWith(), [wide(3)]))).toEqual({
      striker: "a1",
      nonStriker: "a2",
    });
  });

  it("do not cross them on a boundary wide (5 wides)", () => {
    seq = 0;
    const doc = stored(matchWith(), [wide(5)]);
    expect(crease(doc)).toEqual({ striker: "a1", nonStriker: "a2" });
    expect(doc).toMatchObject({ total_runs: 5, extras_wides: 5, total_balls: 0 });
  });

  it("leave the figures as they were: wides to the bowler, not faced", () => {
    seq = 0;
    const doc = stored(matchWith(), [wide(2)]);
    expect(doc.batting?.find((b) => b.user_id === "a1")).toMatchObject({
      runs_scored: 0,
      balls_faced: 0,
    });
    expect(doc.bowling?.[0]).toMatchObject({ runs_conceded: 2, wides: 1 });
  });

  it("decide the ends of a run out at either end like runs off the bat", () => {
    for (const dismissed of ["a1", "a2"]) {
      for (const ran of [0, 1, 2]) {
        const out = { is_wicket: true, dismissal_type: "run_out" };
        const onWide = endsAfterBall(
          ball({ ...out, extras: 1 + ran, extra_type: "wide" }),
          dismissed,
        );
        const offBat = endsAfterBall(
          ball({ ...out, runs_scored: ran }),
          dismissed,
        );
        expect(onWide).toEqual(offBat);
      }
    }
    // A wide, one run, the non-striker run out: the striker ends at the
    // other end, the striker's end empty.
    expect(
      endsAfterBall(
        wide(2, {
          is_wicket: true,
          dismissal_type: "run_out",
          dismissed_player_id: "a2",
        }),
        "a2",
      ),
    ).toEqual({ striker: null, nonStriker: "a1" });
  });

  it("keeps an older wide that carries its runs in runs_scored as it was", () => {
    seq = 0;
    expect(
      crease(stored(matchWith(), [wide(1, { runs_scored: 3 })])),
    ).toEqual({ striker: "a2", nonStriker: "a1" });
    seq = 0;
    expect(
      crease(stored(matchWith(), [wide(2, { runs_scored: 2 })])),
    ).toEqual({ striker: "a1", nonStriker: "a2" });
  });

  it("keeps the new batter the scorer chose after a run out on a wide", () => {
    seq = 0;
    const log = [
      wide(2, {
        is_wicket: true,
        dismissal_type: "run_out",
        dismissed_player_id: "a2",
      }),
    ];
    const afterBall = stored(matchWith(), log);
    // The scorer brings a3 in at the empty (striker's) end.
    const chosen = (afterBall.batting ?? [])
      .map((b) =>
        b.user_id === "a1"
          ? { ...b, is_current_batsman: true, is_striker: false }
          : b,
      )
      .concat([
        {
          ...(afterBall.batting![0]!),
          user_id: "a3",
          runs_scored: 0,
          balls_faced: 0,
          is_out: false,
          dismissal_type: null,
          is_current_batsman: true,
          is_striker: true,
        },
      ]);
    // A recompute (an edit, a penalty) keeps that choice.
    expect(crease(stored(matchWith(), log, chosen))).toEqual({
      striker: "a3",
      nonStriker: "a1",
    });
  });

  it("is predicted exactly as the server recomputes it", () => {
    for (const wideRuns of [false, true]) {
      const match = matchWith(wideRuns);
      for (const extras of [1, 2, 3, 5]) {
        for (const runOut of [null, "a1", "a2"]) {
          seq = 0;
          const log: BallInput[] = [ball({ runs_scored: 0 })];
          const doc = stored(match, log);
          const args: RecordBallArgs = {
            p_match_id: "m1",
            p_bowler_id: "w1",
            p_batsman_id: "a1",
            p_non_striker_id: "a2",
            p_runs_scored: 0,
            p_extras: extras,
            p_extra_type: "wide",
            ...(runOut
              ? {
                  p_is_wicket: true,
                  p_dismissal_type: "run_out",
                  p_dismissed_player_id: runOut,
                }
              : {}),
          };
          const res = checkBallArgs(args);
          if (!res.ok) throw new Error(res.code);
          const docs = ballDocsAfter({
            match,
            innings: doc,
            overDoc:
              oversOfBalls("m1", "i1", log as BallByBallRow[], NOW)[0] ?? null,
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
          expect(crease(shown)).toEqual(crease(server));
          expect(strip(shown.batting)).toEqual(strip(server.batting));
          expect(strip(shown.bowling)).toEqual(strip(server.bowling));
          expect(strip(shown.partnerships)).toEqual(strip(server.partnerships));
          expect(shown.total_runs).toBe(server.total_runs);
        }
      }
    }
  });
});
