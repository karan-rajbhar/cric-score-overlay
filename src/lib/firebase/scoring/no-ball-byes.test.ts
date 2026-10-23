/**
 * Byes and leg byes off a no-ball (`no_ball_runs`): the 1-run penalty is a
 * no-ball extra charged to the bowler; the runs completed are byes (or leg
 * byes), the striker's to face but not to score, and not the bowler's.
 * The screen's prediction (`ballDocsAfter`) must equal the server's
 * recompute of the ball log, as for every other delivery.
 */

import { describe, expect, it } from "vitest";
import { ballDocsAfter, checkBallArgs, type RecordBallArgs } from "./ball-docs";
import { recomputeInnings, type BallInput } from "./recompute";
import { oversOfBalls, scorecardFields } from "../scorecard";
import type { BallByBallRow, InningsRow, MatchesRow } from "../types";

const NOW = "2026-01-01T00:00:00.000Z";
type Match = MatchesRow & { id: string };
type Innings = InningsRow & { id: string };

function matchWith(noballExtrasToBatsman = false): Match {
  return {
    id: "m1",
    balls_per_over: 6,
    max_balls_per_over: null,
    current_innings: 1,
    status: "live",
    wide_runs_to_batsman: false,
    noball_extras_to_batsman: noballExtrasToBatsman,
    wide_counts_as_ball_faced: false,
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

const card = (doc: Innings, id: string) =>
  (doc.batting ?? []).find((b) => b.user_id === id);

describe("byes and leg byes off a no-ball", () => {
  it("count to the team and the extras, not to the striker or the bowler", () => {
    seq = 0;
    const log = [
      // a1 takes a single: a2 on strike.
      ball({ runs_scored: 1 }),
      // No ball, not hit, 2 byes run: no change of ends.
      ball({
        batsman_id: "a2",
        non_striker_id: "a1",
        ball_number: 2,
        extras: 3,
        extra_type: "no_ball",
        no_ball_runs: "bye",
      }),
      // No ball off the pad, 1 leg bye: they cross, a1 on strike.
      ball({
        batsman_id: "a2",
        non_striker_id: "a1",
        ball_number: 2,
        extras: 2,
        extra_type: "no_ball",
        no_ball_runs: "leg_bye",
      }),
      // No ball, boundary byes.
      ball({
        ball_number: 2,
        extras: 5,
        extra_type: "no_ball",
        no_ball_runs: "bye",
      }),
    ];
    const doc = stored(matchWith(), log);

    expect(doc).toMatchObject({
      total_runs: 11,
      total_balls: 1,
      extras_no_balls: 3,
      extras_byes: 6,
      extras_leg_byes: 1,
      extras_total: 10,
    });
    // The striker faced each no-ball but scored none of the byes.
    expect(card(doc, "a1")).toMatchObject({
      runs_scored: 1,
      balls_faced: 2,
      fours: 0,
    });
    expect(card(doc, "a2")).toMatchObject({ runs_scored: 0, balls_faced: 2 });
    // The bowler is charged the single and each no-ball's penalty only.
    expect(doc.bowling?.find((b) => b.user_id === "w1")).toMatchObject({
      runs_conceded: 4,
      no_balls: 3,
      balls_bowled: 1,
    });
    // The leg bye crossed them.
    expect(card(doc, "a1")).toMatchObject({ is_striker: true });
  });

  it("gives the striker only the penalty when no-ball extras go to the batter", () => {
    seq = 0;
    const doc = stored(matchWith(true), [
      ball({ extras: 3, extra_type: "no_ball", no_ball_runs: "bye" }),
    ]);
    expect(card(doc, "a1")).toMatchObject({ runs_scored: 1, balls_faced: 1 });
    expect(doc).toMatchObject({ extras_no_balls: 1, extras_byes: 2 });
  });

  it("reads as off the bat when the field is absent (older balls)", () => {
    seq = 0;
    const doc = stored(matchWith(), [
      ball({ runs_scored: 2, extras: 1, extra_type: "no_ball" }),
    ]);
    // Faced, like every no-ball (see noball-balls-faced.test.ts).
    expect(card(doc, "a1")).toMatchObject({ runs_scored: 2, balls_faced: 1 });
    expect(doc).toMatchObject({ extras_no_balls: 1, extras_byes: 0 });
    expect(doc.bowling?.[0]).toMatchObject({ runs_conceded: 3 });
  });

  it("refuses an unknown kind and ignores the field on other balls", () => {
    const base: RecordBallArgs = {
      p_match_id: "m1",
      p_bowler_id: "w1",
      p_batsman_id: "a1",
      p_non_striker_id: "a2",
      p_extras: 3,
      p_extra_type: "no_ball",
    };
    expect(checkBallArgs({ ...base, p_no_ball_runs: "wide" })).toEqual({
      ok: false,
      code: "invalid_input",
    });
    const plain = checkBallArgs({
      ...base,
      p_extra_type: null,
      p_no_ball_runs: "bye",
    });
    expect(plain.ok && plain.checked.noBallRuns).toBeNull();
  });

  it("is predicted exactly as the server recomputes it", () => {
    for (const noballExtras of [false, true]) {
      const match = matchWith(noballExtras);
      for (const kind of ["bye", "leg_bye"] as const) {
        for (const byes of [0, 1, 2, 4]) {
          seq = 0;
          const log: BallInput[] = [
            ball({ runs_scored: 1 }),
            ball({ batsman_id: "a2", non_striker_id: "a1", ball_number: 2 }),
          ];
          const doc = stored(match, log);
          const args: RecordBallArgs = {
            p_match_id: "m1",
            p_bowler_id: "w1",
            p_batsman_id: "a2",
            p_non_striker_id: "a1",
            p_runs_scored: 0,
            p_extras: 1 + byes,
            p_extra_type: "no_ball",
            p_no_ball_runs: kind,
          };
          const res = checkBallArgs(args);
          if (!res.ok) throw new Error(res.code);
          const overDoc =
            oversOfBalls("m1", "i1", log as BallByBallRow[], NOW)[0] ?? null;
          const docs = ballDocsAfter({
            match,
            innings: doc,
            overDoc,
            args,
            checked: res.checked,
            ballRandom: "x",
            now: NOW,
          });
          expect(docs).not.toBeNull();
          expect(docs!.ball).toMatchObject({
            extras: 1 + byes,
            no_ball_runs: kind,
          });
          const server = stored(match, [...log, docs!.ball as BallInput]);
          const shown = { ...doc, ...docs!.inningsPatch };
          const pick = (d: Innings) => ({
            totals: [
              d.total_runs,
              d.total_balls,
              d.extras_total,
              d.extras_no_balls,
              d.extras_byes,
              d.extras_leg_byes,
            ],
            batting: JSON.stringify(d.batting, (k, v) =>
              k === "updated_at" || k === "created_at" ? undefined : v,
            ),
            bowling: JSON.stringify(d.bowling, (k, v) =>
              k === "updated_at" || k === "created_at" ? undefined : v,
            ),
            partnerships: JSON.stringify(d.partnerships, (k, v) =>
              k === "updated_at" || k === "created_at" ? undefined : v,
            ),
          });
          expect(pick(shown)).toEqual(pick(server));
        }
      }
    }
  });
});
